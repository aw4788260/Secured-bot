import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let libraryData = []; 
  let isLoggedIn = false;

  try {
    // 1. التحقق من هوية المستخدم (Authentication)
    if (userId && deviceId) {
      const { data: deviceCheck } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

      if (deviceCheck && deviceCheck.fingerprint === deviceId) {
        const { data: user } = await supabase
          .from('users')
          .select('id, first_name, username, phone, is_blocked')
          .eq('id', userId)
          .single();

        if (user && !user.is_blocked) {
          userData = user;
          isLoggedIn = true;

          // -----------------------------------------------------------
          // ✅ جلب بيانات المكتبة الخاصة بالطالب
          // (نعتمد هنا على الجداول المربوطة بـ Foreign Keys لضمان دقة العلاقات)
          // -----------------------------------------------------------

          // أ) الكورسات الكاملة
          const { data: fullCourses } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( id, title, code, instructor_name )
            `)
            .eq('user_id', userId);

          // ب) المواد المنفصلة
          const { data: singleSubjects } = await supabase
            .from('user_subject_access')
            .select(`
              subject_id,
              subjects (
                id, title,
                courses ( id, title, code, instructor_name )
              )
            `)
            .eq('user_id', userId);

          // ج) مصفوفات الوصول السريع (IDs)
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          // د) بناء هيكل المكتبة الموحد (Library Structure)
          const libraryMap = new Map();

          // إضافة الكورسات الكاملة
          fullCourses?.forEach(item => {
            if (item.courses) {
              libraryMap.set(item.courses.id, {
                type: 'course',
                id: item.courses.id,
                title: item.courses.title,
                code: item.courses.code,
                instructor: item.courses.instructor_name || 'Instructor',
                owned_subjects: 'all'
              });
            }
          });

          // إضافة المواد المنفصلة
          singleSubjects?.forEach(item => {
            const subject = item.subjects;
            const parentCourse = subject?.courses;

            if (parentCourse) {
              if (libraryMap.has(parentCourse.id)) {
                const existingEntry = libraryMap.get(parentCourse.id);
                if (existingEntry.owned_subjects !== 'all') {
                  existingEntry.owned_subjects.push({
                    id: subject.id,
                    title: subject.title
                  });
                }
              } else {
                libraryMap.set(parentCourse.id, {
                  type: 'subject_group',
                  id: parentCourse.id,
                  title: parentCourse.title,
                  code: parentCourse.code,
                  instructor: parentCourse.instructor_name || 'Instructor',
                  owned_subjects: [{
                    id: subject.id,
                    title: subject.title
                  }]
                });
              }
            }
          });

          libraryData = Array.from(libraryMap.values());
        }
      }
    }

    // -----------------------------------------------------------
    // ✅ 2. جلب الكورسات العامة (المتجر) باستخدام View لتحسين السرعة
    // -----------------------------------------------------------
    // استخدام view_course_details بدلاً من الجدول المباشر courses
    // هذا يسمح بجلب البيانات المجهزة مسبقاً من قاعدة البيانات
    const { data: courses } = await supabase
      .from('view_course_details') 
      .select('*') // نجلب كل الأعمدة المجهزة في الـ View
      .order('sort_order', { ascending: true });

    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,       
      myAccess: userAccess, 
      library: libraryData, 
      courses: courses || [] // هذه القائمة ستغذي المتجر والصفحة الرئيسية
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
