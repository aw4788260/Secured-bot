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
    if (userId && deviceId) {
      // 1. التحقق من الجهاز
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
          // ✅ تصحيح الاستعلامات لجلب اسم المدرس من جدول teachers
          // -----------------------------------------------------------

          // أ) الكورسات الكاملة
          const { data: fullCourses } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( 
                id, title, code, 
                teachers ( name ) 
              )
            `)
            .eq('user_id', userId);

          // ب) المواد المنفصلة
          const { data: singleSubjects } = await supabase
            .from('user_subject_access')
            .select(`
              subject_id,
              subjects (
                id, title,
                courses ( 
                  id, title, code, 
                  teachers ( name ) 
                )
              )
            `)
            .eq('user_id', userId);

          // ج) مصفوفات الوصول السريع
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          // د) بناء هيكل المكتبة
          const libraryMap = new Map();

          // إضافة الكورسات الكاملة
          fullCourses?.forEach(item => {
            if (item.courses) {
              libraryMap.set(item.courses.id, {
                type: 'course',
                id: item.courses.id,
                title: item.courses.title,
                code: item.courses.code,
                // ✅ قراءة اسم المدرس من العلاقة
                instructor: item.courses.teachers?.name || 'Instructor',
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
                  // ✅ قراءة اسم المدرس من العلاقة
                  instructor: parentCourse.teachers?.name || 'Instructor',
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

    // جلب بيانات المتجر (كما هي)
    const { data: courses } = await supabase
      .from('view_course_details') 
      .select('*')
      .order('sort_order', { ascending: true });

    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,       
      myAccess: userAccess, 
      library: libraryData, 
      courses: courses || []
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
