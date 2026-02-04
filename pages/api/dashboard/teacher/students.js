import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

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
  // 2. معالجة طلبات GET (جلب البيانات - لم يتغير)
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
            const validStudentIds = await getMyStudentIds();
            const targetIdStr = String(get_details_for_user);

            if (!validStudentIds.map(String).includes(targetIdStr)) {
                 return res.status(200).json({ courses: [], subjects: [], available_courses: [], available_subjects: [] });
            }

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

            const ownedCourseIds = userCourses?.map(uc => uc.course_id) || [];
            const ownedSubjectIds = userSubjects?.map(us => us.subject_id) || [];

            const availableCourses = myCourses.filter(c => !ownedCourseIds.includes(c.id));

            const availableSubjects = mySubjects.filter(s => {
                const isOwned = ownedSubjectIds.includes(s.id);
                const isParentCourseOwned = ownedCourseIds.includes(s.course_id);
                return !isOwned && !isParentCourseOwned;
            });

            return res.status(200).json({ 
                courses: userCourses || [], 
                subjects: userSubjects || [],
                available_courses: availableCourses,
                available_subjects: availableSubjects
            });
        }

        // --- الحالة 2: الجدول والبحث ---
        let targetStudentIds = await getMyStudentIds();

        if (courses_filter) {
            const filterCourseIds = courses_filter.split(',');
            const { data: filteredByCourse } = await supabase.from('user_course_access').select('user_id').in('course_id', filterCourseIds);
            const usersInCourses = filteredByCourse?.map(x => x.user_id) || [];
            targetStudentIds = targetStudentIds.filter(id => usersInCourses.includes(id));
        }

        if (subjects_filter) {
            const filterSubjectIds = subjects_filter.split(',');
            const { data: filteredBySubject } = await supabase.from('user_subject_access').select('user_id').in('subject_id', filterSubjectIds);
            const usersInSubjects = filteredBySubject?.map(x => x.user_id) || [];
            targetStudentIds = targetStudentIds.filter(id => usersInSubjects.includes(id));
        }

        if (targetStudentIds.length === 0) {
            return res.status(200).json({ students: [], total: 0 });
        }

        let query = supabase
            .from('users')
            .select(`id, first_name, username, phone, created_at, is_blocked, is_admin, devices(fingerprint)`, { count: 'exact' })
            .in('id', targetStudentIds);

        if (search && search.trim() !== '') {
            const term = search.trim();
            let orQuery = `first_name.ilike.%${term}%,username.ilike.%${term}%,phone.ilike.%${term}%`;
            if (/^\d+$/.test(term)) orQuery += `,id.eq.${term}`;
            query = query.or(orQuery);
        }

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
  // 3. معالجة طلبات POST (الإجراءات - التعديل هنا)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      const { action, userIds, userId, grantList } = req.body;
      const targetIds = userIds || (userId ? [userId] : []);

      const myStudentIds = await getMyStudentIds();
      const safeMyIds = myStudentIds.map(String);
      
      // السماح بـ grant_access لأي مستخدم (لإضافته لأول مرة)، لكن تقييد الباقي للطلاب الحاليين
      const isAuthorized = targetIds.every(id => safeMyIds.includes(String(id)) || action === 'grant_access'); 

      if (!isAuthorized && action !== 'grant_access') {
          return res.status(403).json({ error: 'عذراً، هذا الإجراء مسموح فقط على طلابك.' });
      }

      if (action !== 'grant_access' && action !== 'revoke_access') {
          return res.status(403).json({ error: 'عذراً، غير مصرح لك بتعديل بيانات الطلاب أو حذفهم.' });
      }

      try {
          // -- أ) منح صلاحيات (Grant) مع تسجيل مالي --
          if (action === 'grant_access') {
              const { courses = [], subjects = [] } = grantList || {};
              
              // التحقق من الملكية
              const safeCourses = courses.filter(id => myCourseIds.includes(Number(id)) || myCourseIds.includes(String(id)));
              const safeSubjects = subjects.filter(id => mySubjectIds.includes(Number(id)) || mySubjectIds.includes(String(id)));

              // ✅ خطوة 1: جلب تفاصيل المحتوى (للسعر والعنوان)
              let courseInfos = [];
              if (safeCourses.length > 0) {
                  const { data } = await supabase.from('courses').select('id, title, price').in('id', safeCourses);
                  courseInfos = data || [];
              }

              let subjectInfos = [];
              if (safeSubjects.length > 0) {
                  const { data } = await supabase.from('subjects').select('id, title, price, courses(title)').in('id', safeSubjects);
                  subjectInfos = data || [];
              }

              // ✅ خطوة 2: جلب بيانات الطلاب المستهدفين (للسجل)
              const { data: usersData } = await supabase.from('users').select('id, username, first_name, phone').in('id', targetIds);

              const reqInserts = []; // سجلات الطلبات المالية
              const cInserts = [];   // سجلات صلاحيات الكورسات
              const sInserts = [];   // سجلات صلاحيات المواد
              
              targetIds.forEach(uid => {
                  const user = usersData?.find(u => u.id == uid);
                  if (!user) return;

                  // معالجة الكورسات
                  safeCourses.forEach(cid => {
                      const cInfo = courseInfos.find(c => c.id == cid);
                      if (cInfo) {
                          // تسجيل مالي
                          reqInserts.push({
                              user_id: uid,
                              teacher_id: teacherId,
                              status: 'approved',
                              total_price: cInfo.price || 0,
                              user_name: user.first_name,
                              user_username: user.username,
                              phone: user.phone,
                              course_title: cInfo.title,
                              requested_data: [{
                                  id: cid,
                                  type: 'course',
                                  title: cInfo.title,
                                  price: cInfo.price || 0
                              }],
                              user_note: 'تم التفعيل يدوياً من قائمة الطلاب'
                          });
                      }
                      cInserts.push({ user_id: uid, course_id: cid });
                  });

                  // معالجة المواد
                  safeSubjects.forEach(sid => {
                      const sInfo = subjectInfos.find(s => s.id == sid);
                      if (sInfo) {
                           const title = `${sInfo.title} (${sInfo.courses?.title})`;
                           // تسجيل مالي
                           reqInserts.push({
                              user_id: uid,
                              teacher_id: teacherId,
                              status: 'approved',
                              total_price: sInfo.price || 0,
                              user_name: user.first_name,
                              user_username: user.username,
                              phone: user.phone,
                              course_title: title,
                              requested_data: [{
                                  id: sid,
                                  type: 'subject',
                                  title: title,
                                  price: sInfo.price || 0
                              }],
                              user_note: 'تم التفعيل يدوياً من قائمة الطلاب'
                          });
                      }
                      sInserts.push({ user_id: uid, subject_id: sid });
                  });
              });

              // ✅ التنفيذ دفعة واحدة (Bulk Insert)
              if (reqInserts.length > 0) {
                  await supabase.from('subscription_requests').insert(reqInserts);
              }

              if (cInserts.length) await supabase.from('user_course_access').upsert(cInserts, { onConflict: 'user_id, course_id' });
              if (sInserts.length) await supabase.from('user_subject_access').upsert(sInserts, { onConflict: 'user_id, subject_id' });
              
              return res.status(200).json({ success: true, message: 'تم منح الصلاحيات وتسجيل العمليات بنجاح.' });
          }

          // -- ب) سحب صلاحيات (Revoke) - لم يتغير --
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
          console.error("Student Action Error:", err);
          return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
