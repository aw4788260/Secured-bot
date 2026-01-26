import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  // =================================================================
  // GET: جلب البيانات
  // =================================================================
  if (req.method === 'GET') {
    const { mode, query } = req.query;

    try {
      // ✅ 1. وضع جديد: جلب محتوى المعلم فقط (للقوائم المنسدلة عند الإضافة)
      if (mode === 'my_content') {
        const { data: content, error } = await supabase
          .from('courses')
          .select(`
            id, 
            title, 
            subjects (id, title)
          `)
          .eq('teacher_id', teacherId); // شرط مهم: كورسات هذا المعلم فقط

        if (error) throw error;
        return res.status(200).json(content);
      }

      // 🅰️ الوضع الثاني: جلب الطلبات المعلقة (Requests)
      if (mode === 'requests') {
        // أ) نجلب أرقام الكورسات والمواد المملوكة للمعلم
        const { data: myCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('teacher_id', teacherId);
        
        const myCourseIds = myCourses?.map(c => c.id) || [];

        const { data: mySubjects } = await supabase
          .from('subjects')
          .select('id')
          .in('course_id', myCourseIds);
          
        const mySubjectIds = mySubjects?.map(s => s.id) || [];

        // ب) جلب كل الطلبات المعلقة
        const { data: allRequests, error: reqError } = await supabase
          .from('subscription_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;

        // ج) فلترة الطلبات في الذاكرة (لأن الهيكل JSONB)
        const teacherRequests = allRequests.filter(req => {
            const items = req.requested_data || [];
            return items.some(item => {
                if (item.type === 'course') return myCourseIds.includes(item.id);
                if (item.type === 'subject') return mySubjectIds.includes(item.id);
                return false;
            });
        });

        return res.status(200).json(teacherRequests);
      }

      // 🅱️ الوضع الثالث: البحث عن طالب (Search Student)
      if (mode === 'search') {
        if (!query || query.trim().length < 3) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        // أ) البحث عن المستخدم
        const { data: student, error: userError } = await supabase
          .from('users')
          .select('id, first_name, username, phone, created_at, is_blocked')
          .eq('role', 'student') // ✅✅ التعديل هنا: قصر البحث على الطلاب فقط
          .or(`username.eq.${query},phone.eq.${query}`)
          .maybeSingle();
        
        if (userError) throw userError;
        
        // إذا لم يتم العثور على طالب (أو كان المستخدم موجوداً لكنه ليس طالباً)
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // ب) جلب صلاحيات الكورسات (التابعة للمعلم)
        const { data: coursesAccess } = await supabase
          .from('user_course_access')
          .select('course_id, courses!inner(id, title, teacher_id)')
          .eq('user_id', student.id)
          .eq('courses.teacher_id', teacherId);

        // ج) جلب صلاحيات المواد (التابعة للمعلم) مع اسم الكورس الأب
        const { data: subjectsAccess } = await supabase
          .from('user_subject_access')
          // ✅ تم التعديل لجلب subjects -> courses -> title
          .select('subject_id, subjects!inner(id, title, courses!inner(id, title, teacher_id))')
          .eq('user_id', student.id)
          .eq('subjects.courses.teacher_id', teacherId);

        // تنسيق البيانات للواجهة
        const formattedAccess = [
            ...(coursesAccess || []).map(c => ({
                id: c.course_id,
                title: c.courses.title,
                type: 'course',
                subtitle: 'كورس كامل'
            })),
            ...(subjectsAccess || []).map(s => ({
                id: s.subject_id,
                title: s.subjects.title,
                type: 'subject',
                subtitle: `مادة في: ${s.subjects.courses.title}` // ✅ عرض اسم الكورس
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
      // 1️⃣ معالجة طلبات الاشتراك (Handle Request)
      if (action === 'handle_request') {
         const { requestId, decision, rejectionReason } = payload;
         
         // جلب البيانات للتحقق
         const { data: reqData, error: fetchErr } = await supabase
            .from('subscription_requests')
            .select('*')
            .eq('id', requestId)
            .single();
         
         if (fetchErr || !reqData) return res.status(404).json({ error: 'Request not found' });

         // التحقق من الملكية
         const { data: myCourses } = await supabase.from('courses').select('id').eq('teacher_id', teacherId);
         const myCourseIds = myCourses?.map(c => c.id) || [];
         const { data: mySubjects } = await supabase.from('subjects').select('id').in('course_id', myCourseIds);
         const mySubjectIds = mySubjects?.map(s => s.id) || [];

         const items = reqData.requested_data || [];
         const isMyRequest = items.some(item => {
             if (item.type === 'course') return myCourseIds.includes(item.id);
             if (item.type === 'subject') return mySubjectIds.includes(item.id);
             return false;
         });

         if (!isMyRequest) {
             return res.status(403).json({ error: '⛔ Access Denied: Not your content.' });
         }

         if (decision === 'reject') {
             await supabase.from('subscription_requests')
                 .update({ status: 'rejected', rejection_reason: rejectionReason || 'تم الرفض' })
                 .eq('id', requestId);
             return res.status(200).json({ success: true, message: 'Rejected' });
         }

         if (decision === 'approve') {
             let targetUserId = reqData.user_id;
             if (!targetUserId) {
                 // منطق إنشاء أو جلب المستخدم (كما في الكود الأصلي)
                 const { data: existingUser } = await supabase.from('users').select('id').eq('username', reqData.user_username).maybeSingle();
                 if (existingUser) targetUserId = existingUser.id;
                 else {
                     const { data: newUser } = await supabase.from('users').insert({
                         username: reqData.user_username, password: reqData.password_hash,
                         first_name: reqData.user_name, phone: reqData.phone, role: 'student'
                     }).select('id').single();
                     targetUserId = newUser.id;
                 }
             }

             // منح الصلاحيات
             for (const item of items) {
                 if (item.type === 'course') {
                     await supabase.from('user_course_access').upsert({ user_id: targetUserId, course_id: item.id }, { onConflict: 'user_id, course_id' });
                 } else if (item.type === 'subject') {
                     await supabase.from('user_subject_access').upsert({ user_id: targetUserId, subject_id: item.id }, { onConflict: 'user_id, subject_id' });
                 }
             }

             await supabase.from('subscription_requests').update({ status: 'approved', user_id: targetUserId }).eq('id', requestId);
             return res.status(200).json({ success: true, message: 'Approved' });
         }
      }

      // 2️⃣ التحكم المباشر (Manage Access) - إضافة / حذف
      if (action === 'manage_access') {
         const { studentId, type, itemId, allow } = payload;
         
         // أ) التحقق من الملكية
         let isOwner = false;
         if (type === 'course') {
             const { data } = await supabase.from('courses').select('teacher_id').eq('id', itemId).single();
             isOwner = (data && data.teacher_id === teacherId);
         } else if (type === 'subject') {
             const { data } = await supabase.from('subjects').select('courses(teacher_id)').eq('id', itemId).single();
             isOwner = (data && data.courses && data.courses.teacher_id === teacherId);
         }

         if (!isOwner) return res.status(403).json({ error: '⛔ لا تملك هذا المحتوى' });

         // ب) التنفيذ (إضافة أو حذف)
         if (allow) {
           await supabase.from(type === 'course' ? 'user_course_access' : 'user_subject_access')
              .upsert({ user_id: studentId, [`${type}_id`]: itemId }, { onConflict: `user_id, ${type}_id` });
         } else {
           // ✅ إصلاح الحذف: استخدام المفتاح الديناميكي الصحيح (course_id أو subject_id)
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
