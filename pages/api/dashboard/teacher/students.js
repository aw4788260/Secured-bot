import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  // 1. التحقق من الصلاحية وجلب بيانات المدرس
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const teacherId = user.teacherId;
  
  // إذا لم يكن هناك teacherId (مثلاً أدمن عام)، نعتبر القوائم فارغة أو يمكن تعديلها لرؤية الكل
  // هنا سنفترض أننا نريد منطق "المدرس يرى طلابه فقط"
  
  // -- خطوة أ: جلب معرفات المحتوى الخاص بالمدرس (للتأكد من الملكية) --
  // 1. جلب كورسات المدرس
  const { data: myCourses } = await supabase
    .from('courses')
    .select('id, title')
    .eq('teacher_id', teacherId);
    
  const myCourseIds = myCourses?.map(c => c.id) || [];

  // 2. جلب المواد التابعة لكورسات المدرس
  const { data: mySubjects } = await supabase
    .from('subjects')
    .select('id, title, course_id')
    .in('course_id', myCourseIds);
    
  const mySubjectIds = mySubjects?.map(s => s.id) || [];

  // دالة مساعدة: جلب معرفات الطلاب المشتركين عند هذا المدرس فقط
  const getMyStudentIds = async () => {
      // المشتركين في الكورسات
      const { data: cUsers } = await supabase
          .from('user_course_access')
          .select('user_id')
          .in('course_id', myCourseIds);
          
      // المشتركين في المواد
      const { data: sUsers } = await supabase
          .from('user_subject_access')
          .select('user_id')
          .in('subject_id', mySubjectIds);

      // دمج المعرفات وحذف التكرار
      const ids = new Set([
          ...(cUsers?.map(x => x.user_id) || []),
          ...(sUsers?.map(x => x.user_id) || [])
      ]);
      
      return Array.from(ids);
  };

  // ---------------------------------------------------------
  // 2. معالجة طلبات GET (جلب البيانات)
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    const { 
        page = 1, 
        limit = 30, 
        search, 
        get_details_for_user 
    } = req.query;

    try {
        // --- الحالة 1: طلب تفاصيل طالب معين (للمودال) ---
        if (get_details_for_user) {
            // تحقق: هل هذا الطالب من طلابي؟
            const validStudentIds = await getMyStudentIds();
            if (!validStudentIds.includes(Number(get_details_for_user)) && !validStudentIds.includes(String(get_details_for_user))) {
                 return res.status(200).json({ courses: [], subjects: [] }); // ليس طالبك، لا تعرض شيئاً
            }

            // جلب الاشتراكات (فقط الخاصة بهذا المدرس)
            // نستخدم in('course_id', myCourseIds) لضمان عدم عرض كورسات مدرسين آخرين
            const { data: userCourses } = await supabase
                .from('user_course_access')
                .select('course_id, courses(title)')
                .eq('user_id', get_details_for_user)
                .in('course_id', myCourseIds);
            
            const { data: userSubjects } = await supabase
                .from('user_subject_access')
                .select('subject_id, subjects(title, course_id)')
                .eq('user_id', get_details_for_user)
                .in('subject_id', mySubjectIds);

            return res.status(200).json({ 
                courses: userCourses || [], 
                subjects: userSubjects || [] 
            });
        }

        // --- الحالة 2: الجدول والبحث ---
        const myStudentIds = await getMyStudentIds();

        // إذا لم يكن لديك طلاب، نعيد مصفوفة فارغة فوراً
        if (myStudentIds.length === 0) {
            return res.status(200).json({ students: [], total: 0 });
        }

        let query = supabase
            .from('users')
            .select(`id, first_name, username, phone, created_at, is_blocked, is_admin, devices(fingerprint)`, { count: 'exact' })
            .in('id', myStudentIds); // <--- الفلتر الأساسي: طلابي فقط

        // تطبيق البحث (داخل طلابي فقط)
        if (search && search.trim() !== '') {
            const term = search.trim();
            let orQuery = `first_name.ilike.%${term}%,username.ilike.%${term}%,phone.ilike.%${term}%`;
            if (/^\d+$/.test(term)) orQuery += `,id.eq.${term}`;
            query = query.or(orQuery);
        }

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, count, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        const formattedData = data.map(u => ({
            ...u,
            device_linked: u.devices && u.devices.length > 0
        }));

        return res.status(200).json({ 
            students: formattedData, 
            total: count || 0,
            isMainAdmin: false // المدرس ليس الأدمن الرئيسي
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
  }

  // ---------------------------------------------------------
  // 3. معالجة طلبات POST (الإجراءات)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      const { action, userIds, userId, newData, grantList } = req.body;
      const targetIds = userIds || (userId ? [userId] : []);

      // حماية: التأكد من أن جميع المستهدفين هم طلاب هذا المدرس
      const myStudentIds = await getMyStudentIds();
      // ملاحظة: نقوم بتحويل الـ IDs لنصوص للمقارنة الآمنة
      const safeMyIds = myStudentIds.map(String);
      const isAuthorized = targetIds.every(id => safeMyIds.includes(String(id)) || action === 'grant_access'); 
      // استثناء: grant_access قد يكون لطالب جديد، لكن يجب أن يكون الاشتراك في كورس يملكه المدرس (يتم التحقق لاحقاً)

      if (!isAuthorized && action !== 'grant_access') {
          return res.status(403).json({ error: 'عذراً، هذا الإجراء مسموح فقط على طلابك.' });
      }

      try {
          // -- أ) حذف الطالب (غير متاح للمدرس عادة، أو يحذف اشتراكه فقط) --
          if (action === 'delete_user') {
              // المدرس لا يحذف حساب الطالب بالكامل من النظام (لأنه قد يكون مشتركاً عند غيره)
              // بدلاً من ذلك، سنقوم بإلغاء اشتراكه من كورسات المدرس
              await supabase.from('user_course_access').delete().in('user_id', targetIds).in('course_id', myCourseIds);
              await supabase.from('user_subject_access').delete().in('user_id', targetIds).in('subject_id', mySubjectIds);
              
              return res.status(200).json({ success: true, message: 'تم إلغاء اشتراك الطلاب من كورساتك.' });
          }

          // -- ب) فك قفل الجهاز --
          if (action === 'reset_device') {
              await supabase.from('devices').delete().in('user_id', targetIds);
              return res.status(200).json({ success: true, message: 'تم إلغاء قفل الأجهزة.' });
          }

          // -- ج) تغيير الباسورد/الهاتف/الاسم (صلاحيات حساسة) --
          // يمكنك تفعيلها أو تعطيلها حسب رغبتك، هنا سأفعلها لطلابك فقط
          if (action === 'change_password') {
              const hash = await bcrypt.hash(newData.password, 10);
              await supabase.from('users').update({ password: hash }).eq('id', userId);
              return res.status(200).json({ success: true, message: 'تم تغيير كلمة المرور.' });
          }
          if (action === 'change_username') {
             const { data: existing } = await supabase.from('users').select('id').eq('username', newData.username).neq('id', userId).maybeSingle();
             if (existing) return res.status(400).json({ error: 'الاسم مستخدم بالفعل.' });
             await supabase.from('users').update({ username: newData.username }).eq('id', userId);
             return res.status(200).json({ success: true, message: 'تم التحديث.' });
          }
          if (action === 'change_phone') {
             await supabase.from('users').update({ phone: newData.phone }).eq('id', userId);
             return res.status(200).json({ success: true, message: 'تم التحديث.' });
          }

          // -- د) منح صلاحيات (Grant) --
          if (action === 'grant_access') {
              const { courses = [], subjects = [] } = grantList || {};
              
              // حماية: التأكد أن المدرس يمنح صلاحية لكورساته هو فقط
              const safeCourses = courses.filter(id => myCourseIds.includes(Number(id)) || myCourseIds.includes(String(id)));
              const safeSubjects = subjects.filter(id => mySubjectIds.includes(Number(id)) || mySubjectIds.includes(String(id)));

              const cInserts = [];
              const sInserts = [];
              
              targetIds.forEach(uid => {
                  safeCourses.forEach(cid => cInserts.push({ user_id: uid, course_id: cid }));
                  safeSubjects.forEach(sid => sInserts.push({ user_id: uid, subject_id: sid }));
              });

              if (cInserts.length) await supabase.from('user_course_access').upsert(cInserts, { onConflict: 'user_id, course_id' });
              if (sInserts.length) await supabase.from('user_subject_access').upsert(sInserts, { onConflict: 'user_id, subject_id' });
              
              return res.status(200).json({ success: true, message: 'تم منح الصلاحيات للكورسات الخاصة بك فقط.' });
          }

          // -- هـ) سحب صلاحيات (Revoke) --
          if (action === 'revoke_access') {
              const { courseId, subjectId } = req.body;
              
              // حماية: التأكد أن الكورس يخص المدرس
              if (courseId && myCourseIds.includes(Number(courseId))) {
                  await supabase.from('user_course_access').delete().in('user_id', targetIds).eq('course_id', courseId);
              } else if (subjectId && mySubjectIds.includes(Number(subjectId))) {
                  await supabase.from('user_subject_access').delete().in('user_id', targetIds).eq('subject_id', subjectId);
              } else {
                  return res.status(403).json({ error: 'لا تملك صلاحية على هذا المحتوى.' });
              }
              
              return res.status(200).json({ success: true, message: 'تم سحب الصلاحية.' });
          }

      } catch (err) {
          return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
