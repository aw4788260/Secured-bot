import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';
import { notifyStudentSubscriptionDecision } from '../../../lib/notifyHelper';

export default async (req, res) => {
  // 1. التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  // =================================================================
  // GET: جلب البيانات
  // =================================================================
  if (req.method === 'GET') {
    // ✅ إضافة status و page و limit من الاستعلام (لدعم التبويبات والصفحات)
    const { mode, query, status = 'pending', page = 1, limit = 10 } = req.query;

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
          .eq('teacher_id', teacherId);

        if (error) throw error;
        return res.status(200).json(content);
      }

      // 🅰️ الوضع الثاني: جلب الطلبات (Requests) مع الفلترة والصفحات
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

        // ب) جلب الطلبات بناءً على حالتها (مقبولة، مرفوضة، قيد الانتظار)
        const { data: allRequests, error: reqError } = await supabase
          .from('subscription_requests')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;

        // ج) فلترة الطلبات لتشمل فقط محتوى هذا المعلم
        const teacherRequests = allRequests.filter(req => {
            // التوافقية مع التحديث الجديد إذا كان المعرف مسجلاً مباشرة
            if (req.teacher_id === teacherId) return true;

            const items = req.requested_data || [];
            return items.some(item => {
                if (item.type === 'course') return myCourseIds.includes(item.id);
                if (item.type === 'subject') return mySubjectIds.includes(item.id);
                return false;
            });
        });

        // د) نظام الصفحات (Pagination) بمعدل 10 طلبات
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedRequests = teacherRequests.slice(startIndex, startIndex + limitNum);

        // ✅ إرجاع البيانات في شكل {data, count} لدعم عرض الصفحات
        return res.status(200).json({
           data: paginatedRequests,
           count: teacherRequests.length
        });
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
          .eq('role', 'student')
          .or(`username.eq.${query},phone.eq.${query}`)
          .maybeSingle();
        
        if (userError) throw userError;
        
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // ب) جلب صلاحيات الكورسات
        const { data: coursesAccess } = await supabase
          .from('user_course_access')
          .select('course_id, courses!inner(id, title, teacher_id)')
          .eq('user_id', student.id)
          .eq('courses.teacher_id', teacherId);

        // ج) جلب صلاحيات المواد
        const { data: subjectsAccess } = await supabase
          .from('user_subject_access')
          .select('subject_id, subjects!inner(id, title, courses!inner(id, title, teacher_id))')
          .eq('user_id', student.id)
          .eq('subjects.courses.teacher_id', teacherId);

        // تنسيق البيانات
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
                subtitle: `مادة في: ${s.subjects.courses.title}`
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
         
         const { data: reqData, error: fetchErr } = await supabase
            .from('subscription_requests')
            .select('*')
            .eq('id', requestId)
            .single();
         
         if (fetchErr || !reqData) return res.status(404).json({ error: 'Request not found' });

         const { data: myCourses } = await supabase.from('courses').select('id').eq('teacher_id', teacherId);
         const myCourseIds = myCourses?.map(c => c.id) || [];
         const { data: mySubjects } = await supabase.from('subjects').select('id').in('course_id', myCourseIds);
         const mySubjectIds = mySubjects?.map(s => s.id) || [];

         const items = reqData.requested_data || [];
         const isMyRequest = (reqData.teacher_id === teacherId) || items.some(item => {
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
                 
             // ♻️ التعديل الجديد: إعادة تفعيل كود الخصم (إن وُجد) لكي يتمكن الطالب من استخدامه مجدداً
             if (reqData.discount_code_id) {
                 await supabase.from('discount_codes')
                   .update({ is_used: false })
                   .eq('id', reqData.discount_code_id);
             }

             // 🔔 إشعار الطالب بالرفض
             await notifyStudentSubscriptionDecision({
                 userId: reqData.user_id,
                 decision: 'reject',
                 courseTitle: reqData.course_title,
                 rejectionReason: rejectionReason || 'تم الرفض',
                 requestId: reqData.id,
                 senderRole: 'teacher'
             });

             return res.status(200).json({ success: true, message: 'Rejected' });
         }

         if (decision === 'approve') {
             let targetUserId = reqData.user_id;
             if (!targetUserId) {
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

             for (const item of items) {
                 if (item.type === 'course') {
                     await supabase.from('user_course_access').upsert({ user_id: targetUserId, course_id: item.id }, { onConflict: 'user_id, course_id' });
                 } else if (item.type === 'subject') {
                     await supabase.from('user_subject_access').upsert({ user_id: targetUserId, subject_id: item.id }, { onConflict: 'user_id, subject_id' });
                 }
             }

             await supabase.from('subscription_requests').update({ status: 'approved', user_id: targetUserId }).eq('id', requestId);

             // 🔔 إشعار الطالب بالقبول
             await notifyStudentSubscriptionDecision({
                 userId: targetUserId,
                 decision: 'approve',
                 courseTitle: reqData.course_title,
                 requestId: reqData.id,
                 senderRole: 'teacher'
             });

             return res.status(200).json({ success: true, message: 'Approved' });
         }
      }

      // 2️⃣ التحكم المباشر (Manage Access)
      if (action === 'manage_access') {
         const { studentId, type, itemId, allow } = payload;
         
         // أ) التحقق من الملكية وجلب تفاصيل السعر والعنوان
         let isOwner = false;
         let contentTitle = '';
         let contentPrice = 0;

         if (type === 'course') {
             const { data } = await supabase
                .from('courses')
                .select('teacher_id, title, price') // ✅ جلب السعر والعنوان
                .eq('id', itemId)
                .single();
             
             if (data && data.teacher_id === teacherId) {
                isOwner = true;
                contentTitle = data.title;
                contentPrice = data.price || 0;
             }

         } else if (type === 'subject') {
             const { data } = await supabase
                .from('subjects')
                .select('title, price, courses(teacher_id, title)') // ✅ جلب السعر والعنوان
                .eq('id', itemId)
                .single();
             
             if (data && data.courses && data.courses.teacher_id === teacherId) {
                isOwner = true;
                contentTitle = `${data.title} (${data.courses.title})`;
                contentPrice = data.price || 0;
             }
         }

         if (!isOwner) return res.status(403).json({ error: '⛔ لا تملك هذا المحتوى' });

         // ب) التنفيذ
         if (allow) {
            // ✅ خطوة 1: جلب بيانات الطالب لإنشاء السجل
            const { data: studentUser } = await supabase
                .from('users')
                .select('username, first_name, phone')
                .eq('id', studentId)
                .single();

            if (studentUser) {
                // ✅ خطوة 2: تسجيل العملية مالياً في subscription_requests
                await supabase.from('subscription_requests').insert({
                    user_id: studentId,
                    teacher_id: teacherId,
                    status: 'approved', // مقبول فوراً
                    total_price: contentPrice, // السعر لحساب الأرباح
                    actual_paid_price: contentPrice, // يتم تسجيله أيضاً هنا
                    user_name: studentUser.first_name,
                    user_username: studentUser.username,
                    phone: studentUser.phone,
                    course_title: contentTitle, // اسم المحتوى
                    requested_data: [{ // تخزين تفاصيل المحتوى
                        id: itemId,
                        type: type,
                        title: contentTitle,
                        price: contentPrice
                    }],
                    user_note: 'تم التفعيل يدوياً بواسطة المعلم من لوحة التحكم'
                });
            }

            // ✅ خطوة 3: منح الصلاحية فعلياً
            await supabase.from(type === 'course' ? 'user_course_access' : 'user_subject_access')
               .upsert({ user_id: studentId, [`${type}_id`]: itemId }, { onConflict: `user_id, ${type}_id` });

         } else {
            // حالة الحذف (إلغاء الصلاحية)
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
