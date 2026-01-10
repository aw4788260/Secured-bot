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
        // 2. التحقق من المستخدم
        const { data: user } = await supabase
          .from('users')
          .select('id, first_name, username, phone, is_blocked')
          .eq('id', userId)
          .single();

        if (user && !user.is_blocked) {
          userData = user;
          isLoggedIn = true;

          // ==========================================
          // منطق المكتبة (Library Logic)
          // ==========================================

          // أ) جلب الكورسات الكاملة (بدون المواد المتداخلة لتجنب الأخطاء)
          const { data: fullCourses } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( 
                id, title, code, teacher_id,
                teachers ( name )
              )
            `)
            .eq('user_id', userId);

          // ب) ✅ جلب مواد هذه الكورسات بشكل منفصل (أضمن طريقة لظهور البيانات)
          let courseSubjectsMap = {};
          
          if (fullCourses && fullCourses.length > 0) {
            // استخراج معرفات الكورسات
            const courseIds = fullCourses.map(item => item.course_id);

            // استعلام مباشر لجلب المواد الخاصة بهذه الكورسات فقط
            const { data: allSubjects } = await supabase
                .from('subjects')
                .select('id, title, course_id, sort_order')
                .in('course_id', courseIds)
                .order('sort_order', { ascending: true }); 

            // تجميع المواد داخل Map
            if (allSubjects) {
                allSubjects.forEach(sub => {
                    if (!courseSubjectsMap[sub.course_id]) {
                        courseSubjectsMap[sub.course_id] = [];
                    }
                    courseSubjectsMap[sub.course_id].push({ id: sub.id, title: sub.title });
                });
            }
          }

          // ج) جلب المواد المنفصلة
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

          // هيكلة بيانات الصلاحيات
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          const libraryMap = new Map();

          // 1. إضافة الكورسات الكاملة للمكتبة
          fullCourses?.forEach(item => {
            if (item.courses) {
              const cId = item.courses.id;
              // ✅ هنا نضع قائمة المواد التي جلبناها في الخطوة (ب)
              const subjectsList = courseSubjectsMap[cId] || [];

              libraryMap.set(cId, {
                type: 'course',
                id: cId,
                title: item.courses.title,
                code: item.courses.code,
                instructor: item.courses.teachers?.name || 'Instructor',
                teacherId: item.courses.teacher_id, 
                owned_subjects: subjectsList // ✅ إرسال القائمة الحقيقية للمواد
              });
            }
          });

          // 2. إضافة المواد المنفصلة للمكتبة
          singleSubjects?.forEach(item => {
            const subject = item.subjects;
            const parentCourse = subject?.courses;

            if (parentCourse) {
              if (libraryMap.has(parentCourse.id)) {
                const existingEntry = libraryMap.get(parentCourse.id);
                // لو الكورس كامل، خلاص المواد جت في الخطوة اللي فاتت
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

    // -----------------------------------------------------------
    // ✅ جلب بيانات المتجر باستخدام الـ View كما طلبت
    // -----------------------------------------------------------
    const { data: courses } = await supabase
      .from('view_course_details') // ✅ تم الابقاء على الـ View
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
