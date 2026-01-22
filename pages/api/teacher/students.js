import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  // =================================================================
  // GET: جلب البيانات (الطلبات المعلقة أو البحث عن طالب)
  // =================================================================
  if (req.method === 'GET') {
    const { mode, query } = req.query;

    try {
      // 🅰️ الوضع الأول: جلب الطلبات المعلقة (Requests)
      if (mode === 'requests') {
        // 1. جلب كل الكورسات والمواد المملوكة للمعلم
        // نحتاج معرفة الأرقام لفلترة الطلبات التي تخص هذا المعلم فقط
        const { data: myCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('teacher_id', teacherId);
        
        const myCourseIds = myCourses?.map(c => c.id) || [];

        // نجلب المواد التابعة لهذه الكورسات أيضاً (لأن الطالب قد يشتري مادة منفصلة)
        const { data: mySubjects } = await supabase
          .from('subjects')
          .select('id')
          .in('course_id', myCourseIds);
          
        const mySubjectIds = mySubjects?.map(s => s.id) || [];

        // 2. جلب كل الطلبات المعلقة
        // (للأسف لا يمكن الفلترة العميقة داخل JSONB Array بسهولة في Supabase مباشرة لعدة قيم، لذا نجلب المعلق ونفلتره)
        const { data: allRequests, error: reqError } = await supabase
          .from('subscription_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;

        // 3. فلترة الطلبات: نعرض الطلب فقط إذا كان يحتوي على كورس أو مادة تابعة للمعلم
        const teacherRequests = allRequests.filter(req => {
            const items = req.requested_data || [];
            // هل يوجد أي عنصر في الطلب يملكه هذا المعلم؟
            return items.some(item => {
                if (item.type === 'course') return myCourseIds.includes(item.id);
                if (item.type === 'subject') return mySubjectIds.includes(item.id);
                return false;
            });
        });

        return res.status(200).json(teacherRequests);
      }

      // 🅱️ الوضع الثاني: البحث عن طالب (Search Student)
      if (mode === 'search') {
        if (!query || query.trim().length < 3) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        // أ) البحث عن المستخدم
        const { data: student, error: userError } = await supabase
          .from('users')
          .select('id, first_name, username, phone, created_at, is_blocked')
          .or(`username.eq.${query},phone.eq.${query}`)
          .maybeSingle();
        
        if (userError) throw userError;
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // ب) جلب صلاحيات الطالب التابعة لهذا المعلم فقط
        const { data: coursesAccess } = await supabase
          .from('user_course_access')
          .select('course_id, courses!inner(id, title, teacher_id)')
          .eq('user_id', student.id)
          .eq('courses.teacher_id', teacherId);

        const { data: subjectsAccess } = await supabase
          .from('user_subject_access')
          .select('subject_id, subjects!inner(id, title, courses!inner(teacher_id))')
          .eq('user_id', student.id)
          .eq('subjects.courses.teacher_id', teacherId);

        const formattedAccess = [
            ...(coursesAccess || []).map(c => ({
                id: c.course_id,
                title: c.courses.title,
                type: 'course'
            })),
            ...(subjectsAccess || []).map(s => ({
                id: s.subject_id,
                title: s.subjects.title,
                type: 'subject'
            }))
        ];

        return res.status(200).json({ 
          student, 
          access: formattedAccess 
        });
      }

      return res.status(400).json({ error: 'Invalid mode' });

    } catch (err) {
      console.error("Teacher Students API Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // =================================================================
  // POST: تنفيذ الإجراءات
  // =================================================================
  if (req.method === 'POST') {
    const { action, payload } = req.body; 

    try {
      if (action === 'handle_request') {
         const { requestId, decision, rejectionReason } = payload;
         
         // 1. جلب بيانات الطلب
         const { data: reqData, error: fetchErr } = await supabase
            .from('subscription_requests')
            .select('*') // لا نستخدم join مع courses لأن course_id قد يكون فارغاً
            .eq('id', requestId)
            .single();
         
         if (fetchErr || !reqData) return res.status(404).json({ error: 'Request not found' });

         // 2. التحقق الأمني: هل الطلب يحتوي على شيء يخص المعلم؟
         // نعيد جلب كورسات المعلم للتحقق
         const { data: myCourses } = await supabase.from('courses').select('id').eq('teacher_id', teacherId);
         const myCourseIds = myCourses?.map(c => c.id) || [];
         
         // (للتبسيط سنتحقق من الكورسات فقط هنا، أو يمكنك جلب المواد أيضاً إذا لزم الأمر)
         const { data: mySubjects } = await supabase.from('subjects').select('id').in('course_id', myCourseIds);
         const mySubjectIds = mySubjects?.map(s => s.id) || [];

         const items = reqData.requested_data || [];
         const isMyRequest = items.some(item => {
             if (item.type === 'course') return myCourseIds.includes(item.id);
             if (item.type === 'subject') return mySubjectIds.includes(item.id);
             return false;
         });

         if (!isMyRequest) {
             return res.status(403).json({ error: '⛔ Access Denied: This request does not contain your content.' });
         }

         // الرفض
         if (decision === 'reject') {
             await supabase.from('subscription_requests')
                 .update({ 
                    status: 'rejected', 
                    rejection_reason: rejectionReason || 'تم الرفض من قبل المعلم' 
                 })
                 .eq('id', requestId);
             return res.status(200).json({ success: true, message: 'Request Rejected' });
         }

         // القبول
         if (decision === 'approve') {
             let targetUserId = reqData.user_id;
             
             // إنشاء مستخدم إذا لم يوجد
             if (!targetUserId) {
                 const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', reqData.user_username)
                    .maybeSingle();
                 
                 if (existingUser) {
                     targetUserId = existingUser.id;
                 } else {
                     const { data: newUser, error: createErr } = await supabase.from('users').insert({
                         username: reqData.user_username,
                         password: reqData.password_hash,
                         first_name: reqData.user_name,
                         phone: reqData.phone,
                         role: 'student'
                     }).select('id').single();
                     
                     if (createErr) throw createErr;
                     targetUserId = newUser.id;
                 }
             }

             // منح الصلاحيات
             for (const item of items) {
                 if (item.type === 'course') {
                     await supabase.from('user_course_access').upsert(
                         { user_id: targetUserId, course_id: item.id }, 
                         { onConflict: 'user_id, course_id' }
                     );
                 } else if (item.type === 'subject') {
                     await supabase.from('user_subject_access').upsert(
                         { user_id: targetUserId, subject_id: item.id }, 
                         { onConflict: 'user_id, subject_id' }
                     );
                 }
             }

             await supabase.from('subscription_requests')
                .update({ status: 'approved', user_id: targetUserId })
                .eq('id', requestId);

             return res.status(200).json({ success: true, message: 'Request Approved' });
         }
      }

      // الإجراء الثاني: التحكم المباشر (Manage Access) - لم يتغير
      if (action === 'manage_access') {
         const { studentId, type, itemId, allow } = payload;
         
         let isOwner = false;
         if (type === 'course') {
             const { data } = await supabase.from('courses').select('teacher_id').eq('id', itemId).single();
             isOwner = (data && data.teacher_id === teacherId);
         } else if (type === 'subject') {
             const { data } = await supabase.from('subjects').select('courses(teacher_id)').eq('id', itemId).single();
             isOwner = (data && data.courses && data.courses.teacher_id === teacherId);
         }

         if (!isOwner) return res.status(403).json({ error: '⛔ Security Alert: You do not own this content.' });

         if (allow) {
           await supabase.from(type === 'course' ? 'user_course_access' : 'user_subject_access')
              .upsert({ user_id: studentId, [`${type}_id`]: itemId }, { onConflict: `user_id, ${type}_id` });
         } else {
           await supabase.from(type === 'course' ? 'user_course_access' : 'user_subject_access')
              .delete().eq('user_id', studentId).eq(`${type}_id`, itemId);
         }
         return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown Action' });

    } catch (err) {
      console.error("Teacher Action Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
};
