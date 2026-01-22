import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من صلاحية المعلم (Token + Device + Role)
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  // =================================================================
  // GET: جلب البيانات (الطلبات المعلقة أو البحث عن طالب)
  // =================================================================
  if (req.method === 'GET') {
    const { mode, query } = req.query; // mode: 'requests' OR 'search'

    try {
      // 🅰️ الوضع الأول: جلب الطلبات المعلقة (Requests)
      if (mode === 'requests') {
        // أ) نجلب أرقام الكورسات المملوكة لهذا المعلم فقط
        const { data: myCourses, error: courseError } = await supabase
          .from('courses')
          .select('id')
          .eq('teacher_id', teacherId);

        if (courseError) throw courseError;

        const courseIds = myCourses?.map(c => c.id) || [];

        if (courseIds.length === 0) return res.status(200).json([]);

        // ب) نجلب الطلبات المرتبطة بهذه الكورسات فقط
        const { data: requests, error: reqError } = await supabase
          .from('subscription_requests')
          .select('*')
          .in('course_id', courseIds) // 🔒 فلترة صارمة
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;

        return res.status(200).json(requests);
      }

      // 🅱️ الوضع الثاني: البحث عن طالب (Search Student)
      if (mode === 'search') {
        if (!query || query.trim().length < 3) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        // أ) البحث عن المستخدم (بالهاتف أو اسم المستخدم)
        const { data: student, error: userError } = await supabase
          .from('users')
          .select('id, first_name, username, phone, created_at, is_blocked')
          .or(`username.eq.${query},phone.eq.${query}`)
          .maybeSingle();
        
        if (userError) throw userError;
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // ب) جلب صلاحيات الطالب (الكورسات) التابعة لهذا المعلم فقط
        const { data: coursesAccess } = await supabase
          .from('user_course_access')
          .select('course_id, courses!inner(id, title, teacher_id)')
          .eq('user_id', student.id)
          .eq('courses.teacher_id', teacherId); // 🔒 شرط جوهري: المعلم يرى كورساته فقط

        // ج) جلب صلاحيات الطالب (المواد المنفصلة) التابعة لهذا المعلم فقط
        // ملاحظة: نحتاج للوصول لـ teacher_id عبر جدول courses المرتبط بـ subjects
        const { data: subjectsAccess } = await supabase
          .from('user_subject_access')
          .select('subject_id, subjects!inner(id, title, courses!inner(teacher_id))')
          .eq('user_id', student.id)
          .eq('subjects.courses.teacher_id', teacherId); // 🔒 شرط جوهري

        // تنسيق البيانات للعرض
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
  // POST: تنفيذ الإجراءات (قبول/رفض/منح/سحب)
  // =================================================================
  if (req.method === 'POST') {
    const { action, payload } = req.body; 

    try {
      // 🅰️ الإجراء الأول: التعامل مع طلب اشتراك (Handle Request)
      if (action === 'handle_request') {
         const { requestId, decision, rejectionReason } = payload; // decision: 'approve' | 'reject'
         
         // 1. التحقق من أن الطلب يخص كورس مملوك للمعلم
         const { data: reqData, error: fetchErr } = await supabase
            .from('subscription_requests')
            .select('*, courses!inner(teacher_id)')
            .eq('id', requestId)
            .single();
         
         if (fetchErr || !reqData) return res.status(404).json({ error: 'Request not found' });

         // 🔒 التحقق الأمني: هل الكورس يتبع لهذا المعلم؟
         if (reqData.courses.teacher_id !== teacherId) {
             return res.status(403).json({ error: '⛔ Access Denied: This request belongs to another teacher.' });
         }

         // حالة الرفض
         if (decision === 'reject') {
             await supabase.from('subscription_requests')
                 .update({ 
                    status: 'rejected', 
                    rejection_reason: rejectionReason || 'تم الرفض من قبل المعلم' 
                 })
                 .eq('id', requestId);
             return res.status(200).json({ success: true, message: 'Request Rejected' });
         }

         // حالة القبول (إنشاء مستخدم + منح صلاحية)
         if (decision === 'approve') {
             let targetUserId = reqData.user_id;
             
             // إذا لم يكن هناك ID مستخدم (طالب جديد)، نحاول البحث أو الإنشاء
             if (!targetUserId) {
                 const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', reqData.user_username)
                    .maybeSingle();
                 
                 if (existingUser) {
                     targetUserId = existingUser.id;
                 } else {
                     // إنشاء حساب جديد للطالب
                     const { data: newUser, error: createErr } = await supabase.from('users').insert({
                         username: reqData.user_username,
                         password: reqData.password_hash, // كلمة المرور مشفرة مسبقاً من الطلب
                         first_name: reqData.user_name,
                         phone: reqData.phone,
                         role: 'student'
                     }).select('id').single();
                     
                     if (createErr) throw createErr;
                     targetUserId = newUser.id;
                 }
             }

             // منح الصلاحيات
             const items = reqData.requested_data || [];
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

             // تحديث الطلب
             await supabase.from('subscription_requests')
                .update({ status: 'approved', user_id: targetUserId })
                .eq('id', requestId);

             return res.status(200).json({ success: true, message: 'Request Approved' });
         }
      }

      // 🅱️ الإجراء الثاني: التحكم المباشر في الصلاحيات (Manage Access)
      if (action === 'manage_access') {
         const { studentId, type, itemId, allow } = payload; // type: 'course' | 'subject'
         
         // 🔒 التحقق الأمني: هل العنصر الذي يحاول المعلم منحه/سحبه يملكه هو؟
         let isOwner = false;

         if (type === 'course') {
             const { data } = await supabase.from('courses').select('teacher_id').eq('id', itemId).single();
             isOwner = (data && data.teacher_id === teacherId);
         } else if (type === 'subject') {
             // للمادة، نتحقق من الكورس الأب
             const { data } = await supabase.from('subjects').select('courses(teacher_id)').eq('id', itemId).single();
             isOwner = (data && data.courses && data.courses.teacher_id === teacherId);
         }

         if (!isOwner) {
             return res.status(403).json({ error: '⛔ Security Alert: You do not own this content.' });
         }

         // تنفيذ العملية
         if (allow) {
           await supabase.from(type === 'course' ? 'user_course_access' : 'user_subject_access')
              .upsert({ user_id: studentId, [`${type}_id`]: itemId }, { onConflict: `user_id, ${type}_id` });
         } else {
           await supabase.from(type === 'course' ? 'user_course_access' : 'user_subject_access')
              .delete()
              .eq('user_id', studentId)
              .eq(`${type}_id`, itemId);
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
