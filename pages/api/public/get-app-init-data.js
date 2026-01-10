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
      // التحقق من الجهاز
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

          // --- منطق المكتبة الخاصة (Library) ---
          
          // 1. جلب الكورسات الكاملة (بدون المواد المتداخلة لتجنب الخطأ)
          const { data: fullCourses, error: fcError } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( 
                id, title, code, teacher_id,
                teachers ( name )
              )
            `)
            .eq('user_id', userId);

          if (fcError) console.error("Full Courses Error:", fcError);

          // 2. جلب المواد (Subjects) لهذه الكورسات في استعلام منفصل آمن
          let courseSubjectsMap = {};
          if (fullCourses && fullCourses.length > 0) {
              const courseIds = fullCourses.map(c => c.course_id);
              
              const { data: allSubjects } = await supabase
                  .from('subjects')
                  .select('id, title, course_id')
                  .in('course_id', courseIds)
                  .order('sort_order', { ascending: true }); // ترتيب المواد

              // تجميع المواد حسب الكورس
              if (allSubjects) {
                  allSubjects.forEach(sub => {
                      if (!courseSubjectsMap[sub.course_id]) {
                          courseSubjectsMap[sub.course_id] = [];
                      }
                      courseSubjectsMap[sub.course_id].push({ id: sub.id, title: sub.title });
                  });
              }
          }

          // 3. جلب المواد المنفصلة (التي اشتراها الطالب بشكل فردي)
          const { data: singleSubjects } = await supabase
            .from('user_subject_access')
            .select(`
              subject_id,
              subjects (
                id, title,
                courses ( 
                  id, title, code, teacher_id,
                  teachers ( name ) 
                )
              )
            `)
            .eq('user_id', userId);

          // هيكلة بيانات المكتبة
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          const libraryMap = new Map();

          // إضافة الكورسات الكاملة للمكتبة
          fullCourses?.forEach(item => {
            if (item.courses) {
              const cId = item.courses.id;
              // نأخذ المواد من الـ Map التي جهزناها في الخطوة 2
              const subjectsList = courseSubjectsMap[cId] || [];

              libraryMap.set(cId, {
                type: 'course',
                id: cId,
                title: item.courses.title,
                code: item.courses.code,
                instructor: item.courses.teachers?.name || 'Instructor',
                teacherId: item.courses.teacher_id, 
                owned_subjects: subjectsList // ✅ إرسال القائمة الصحيحة
              });
            }
          });

          // إضافة المواد المنفصلة للمكتبة
          singleSubjects?.forEach(item => {
            const subject = item.subjects;
            const parentCourse = subject?.courses;

            if (parentCourse) {
              if (libraryMap.has(parentCourse.id)) {
                const existingEntry = libraryMap.get(parentCourse.id);
                // إذا كان الكورس موجوداً كاشتراك كامل (type='course')، لا نفعل شيئاً
                // لأننا جلبنا كل مواده بالفعل في الخطوة السابقة.
                // أما إذا كان تجميعة مواد (type='subject_group')، نضيف المادة.
                if (existingEntry.type === 'subject_group') { 
                   existingEntry.owned_subjects.push({ id: subject.id, title: subject.title });
                }
              } else {
                libraryMap.set(parentCourse.id, {
                  type: 'subject_group',
                  id: parentCourse.id,
                  title: parentCourse.title,
                  code: parentCourse.code,
                  instructor: parentCourse.teachers?.name || 'Instructor',
                  teacherId: parentCourse.teacher_id,
                  owned_subjects: [{ id: subject.id, title: subject.title }]
                });
              }
            }
          });

          libraryData = Array.from(libraryMap.values());
        }
      }
    }

    // جلب بيانات المتجر
    // ملاحظة: إذا كنت حذفت الـ View، يفضل استخدام الجدول مباشرة هنا أيضاً لتجنب الأخطاء
    const { data: courses } = await supabase
      .from('courses') // استخدام الجدول مباشرة بدلاً من view_course_details
      .select(`
        id, title, price, code, sort_order, description,
        teacher_id,
        teachers ( name )
      `)
      .order('sort_order', { ascending: true });

    // تنسيق بيانات المتجر
    const formattedStoreCourses = courses?.map(c => ({
        ...c,
        instructor_name: c.teachers?.name || 'Instructor'
    })) || [];

    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,       
      myAccess: userAccess, 
      library: libraryData, 
      courses: formattedStoreCourses 
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
