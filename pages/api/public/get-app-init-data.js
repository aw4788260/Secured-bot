import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let libraryData = []; // هذه المصفوفة ستحتوي على البيانات النصية الكاملة
  let isLoggedIn = false;

  try {
    // 1. التحقق من المستخدم والجهاز
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

          // -------------------------------------------------------
          // ✅ التعديل: جلب النصوص (اسم الكورس، المدرس، الكود)
          // -------------------------------------------------------

          // أ) جلب الكورسات الكاملة مع تفاصيلها النصية
          const { data: fullCourses } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses (
                id,
                title,
                code,
                instructor_name
              )
            `)
            .eq('user_id', userId);

          // ب) جلب المواد المنفصلة مع تفاصيلها وتفاصيل الكورس الأب
          const { data: singleSubjects } = await supabase
            .from('user_subject_access')
            .select(`
              subject_id,
              subjects (
                id,
                title,
                courses (
                  id,
                  title,
                  code,
                  instructor_name
                )
              )
            `)
            .eq('user_id', userId);

          // ج) تجميع الـ IDs للوصول السريع (للحماية)
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          // د) بناء هيكل "المكتبة" (Library) للعرض في التطبيق
          const libraryMap = new Map();

          // 1. إضافة الكورسات الكاملة للمكتبة
          fullCourses?.forEach(item => {
            if (item.courses) {
              libraryMap.set(item.courses.id, {
                type: 'course',
                id: item.courses.id,
                title: item.courses.title,             // ✅ اسم الكورس
                code: item.courses.code,               // ✅ كود الكورس
                instructor: item.courses.instructor_name || 'Instructor', // ✅ اسم المدرس
                owned_subjects: 'all' // يملك الكورس بالكامل
              });
            }
          });

          // 2. إضافة المواد المنفصلة ودمجها تحت الكورس الخاص بها
          singleSubjects?.forEach(item => {
            const subject = item.subjects;
            const parentCourse = subject?.courses;

            if (parentCourse) {
              // إذا كان الكورس موجوداً بالفعل في القائمة
              if (libraryMap.has(parentCourse.id)) {
                const existingEntry = libraryMap.get(parentCourse.id);
                // نضيف المادة فقط إذا لم يكن يملك الكورس بالكامل
                if (existingEntry.owned_subjects !== 'all') {
                  existingEntry.owned_subjects.push({
                    id: subject.id,
                    title: subject.title // ✅ اسم المادة
                  });
                }
              } else {
                // إذا لم يكن موجوداً، ننشئ مدخلاً جديداً للكورس (Container)
                libraryMap.set(parentCourse.id, {
                  type: 'subject_group',
                  id: parentCourse.id,
                  title: parentCourse.title,             // ✅ اسم الكورس
                  code: parentCourse.code,               // ✅ كود الكورس
                  instructor: parentCourse.instructor_name || 'Instructor', // ✅ اسم المدرس
                  owned_subjects: [{
                    id: subject.id,
                    title: subject.title // ✅ اسم المادة
                  }]
                });
              }
            }
          });

          libraryData = Array.from(libraryMap.values());
        }
      }
    }

    // 2. جلب قائمة الكورسات العامة للمتجر (مع التفاصيل أيضاً)
    const { data: courses } = await supabase
      .from('courses') // أو view_course_details
      .select('id, title, code, instructor_name, price, sort_order')
      .order('sort_order', { ascending: true });

    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,
      myAccess: userAccess, // للتحقق من الصلاحيات (IDs)
      library: libraryData, // ✅ للعرض في التطبيق (نصوص كاملة)
      courses: courses || [] 
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
