import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  // 1. التحقق من الصلاحية وجلب بيانات المدرس
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const teacherId = user.teacherId;

  // -- خطوة أ: جلب معرفات المحتوى الخاص بالمدرس (للتأكد من الملكية وللقوائم) --
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
        get_details_for_user,
        courses_filter,
        subjects_filter
    } = req.query;

    try {
        // --- الحالة 1: طلب تفاصيل طالب معين (للمودال) ---
        if (get_details_for_user) {
            // تحقق: هل هذا الطالب من طلابي؟
            const validStudentIds = await getMyStudentIds();
            const targetIdStr = String(get_details_for_user);

            // تحويل الكل لنصوص للمقارنة الآمنة
            if (!validStudentIds.map(String).includes(targetIdStr)) {
                 // إرجاع مصفوفات فارغة لضمان عدم حدوث خطأ في الواجهة
                 return res.status(200).json({ courses: [], subjects: [], available_courses: [], available_subjects: [] });
            }

            // 1. جلب الاشتراكات الحالية للطالب (فقط الخاصة بهذا المدرس)
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

            // استخراج IDs التي يملكها الطالب حالياً
            const ownedCourseIds = userCourses?.map(uc => uc.course_id) || [];
            const ownedSubjectIds = userSubjects?.map(us => us.subject_id) || [];

            // 2. حساب الكورسات المتاحة للإضافة (التي لا يملكها)
            const availableCourses = myCourses.filter(c => !ownedCourseIds.includes(c.id));

            // 3. حساب المواد المتاحة للإضافة
            // الشروط: الطالب لا يملك المادة AND الطالب لا يملك الكورس الكامل التابعة له المادة
            const availableSubjects = mySubjects.filter(s => {
                const isOwned = ownedSubjectIds.includes(s.id);
                const isParentCourseOwned = ownedCourseIds.includes(s.course_id);
                return !isOwned && !isParentCourseOwned;
            });

            return res.status(200).json({ 
                courses: userCourses || [], 
                subjects: userSubjects || [],
                available_courses: availableCourses, // <--- القائمة المفلترة للكورسات
                available_subjects: availableSubjects // <--- القائمة المفلترة للمواد
            });
        }

        // --- الحالة 2: الجدول والبحث ---
        
        // 1. نبدأ بكل طلاب المدرس
        let targetStudentIds = await getMyStudentIds();

        // 2. تطبيق فلتر الكورسات (إذا تم تحديده)
        if (courses_filter) {
            const filterCourseIds = courses_filter.split(',');
            
            // جلب الطلاب المشتركين في هذه الكورسات المحددة فقط
            const { data: filteredByCourse } = await supabase
                .from('user_course_access')
                .select('user_id')
                .in('course_id', filterCourseIds);
            
            const usersInCourses = filteredByCourse?.map(x => x.user_id) || [];
            
            // الاحتفاظ فقط بالطلاب الموجودين في القائمة الأساسية AND في الفلتر
            targetStudentIds = targetStudentIds.filter(id => usersInCourses.includes(id));
        }

        // 3. تطبيق فلتر المواد (إذا تم تحديده)
        if (subjects_filter) {
            const filterSubjectIds = subjects_filter.split(',');
            
            const { data: filteredBySubject } = await supabase
                .from('user_subject_access')
                .select('user_id')
                .in('subject_id', filterSubjectIds);
            
            const usersInSubjects = filteredBySubject?.map(x => x.user_id) || [];
            
            targetStudentIds = targetStudentIds.filter(id => usersInSubjects.includes(id));
        }

        // إذا أصبحت القائمة فارغة بعد الفلترة، نرجع نتيجة فارغة فوراً
        if (targetStudentIds.length === 0) {
            return res.status(200).json({ students: [], total: 0 });
        }

        // 4. بناء الاستعلام النهائي
        let query = supabase
            .from('users')
            .select(`id, first_name, username, phone, created_at, is_blocked, is_admin, devices(fingerprint)`, { count: 'exact' })
            .in('id', targetStudentIds); // <--- الفلتر الأساسي: القائمة المفلترة

        // تطبيق البحث (داخل القائمة المفلترة)
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
            isMainAdmin: false 
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
      const safeMyIds = myStudentIds.map(String);
      
      // السماح بـ grant_access لأي طالب، وغير ذلك لطلابي فقط
      const isAuthorized = targetIds.every(id => safeMyIds.includes(String(id)) || action === 'grant_access'); 

      if (!isAuthorized && action !== 'grant_access') {
          return res.status(403).json({ error: 'عذراً، هذا الإجراء مسموح فقط على طلابك.' });
      }

      try {
          // -- أ) حذف الطالب (إلغاء اشتراك) --
          if (action === 'delete_user') {
              await supabase.from('user_course_access').delete().in('user_id', targetIds).in('course_id', myCourseIds);
              await supabase.from('user_subject_access').delete().in('user_id', targetIds).in('subject_id', mySubjectIds);
              
              return res.status(200).json({ success: true, message: 'تم إلغاء اشتراك الطلاب من كورساتك.' });
          }

          // -- ب) فك قفل الجهاز --
          if (action === 'reset_device') {
              await supabase.from('devices').delete().in('user_id', targetIds);
              return res.status(200).json({ success: true, message: 'تم إلغاء قفل الأجهزة.' });
          }

          // -- ج) تغيير الباسورد --
          if (action === 'change_password') {
              const hash = await bcrypt.hash(newData.password, 10);
              await supabase.from('users').update({ password: hash }).eq('id', userId);
              return res.status(200).json({ success: true, message: 'تم تغيير كلمة المرور.' });
          }

          // -- د) تغيير اسم المستخدم --
          if (action === 'change_username') {
             const { data: existing } = await supabase.from('users').select('id').eq('username', newData.username).neq('id', userId).maybeSingle();
             if (existing) return res.status(400).json({ error: 'الاسم مستخدم بالفعل.' });
             await supabase.from('users').update({ username: newData.username }).eq('id', userId);
             return res.status(200).json({ success: true, message: 'تم التحديث.' });
          }

          // -- هـ) تغيير الهاتف --
          if (action === 'change_phone') {
             // التحقق من وجود الرقم مسبقاً لمستخدم آخر
             const { data: existingPhone } = await supabase
                 .from('users')
                 .select('id')
                 .eq('phone', newData.phone)
                 .neq('id', userId) // استثناء المستخدم الحالي من الفحص
                 .maybeSingle();

             if (existingPhone) {
                 return res.status(400).json({ error: 'رقم الهاتف مستخدم بالفعل لحساب آخر.' });
             }

             await supabase.from('users').update({ phone: newData.phone }).eq('id', userId);
             return res.status(200).json({ success: true, message: 'تم تحديث رقم الهاتف بنجاح.' });
          }

          // -- و) منح صلاحيات (Grant) --
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
              
              return res.status(200).json({ success: true, message: 'تم منح الصلاحيات.' });
          }

          // -- ز) سحب صلاحيات (Revoke) --
          if (action === 'revoke_access') {
              const { courseId, subjectId } = req.body;
              
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
