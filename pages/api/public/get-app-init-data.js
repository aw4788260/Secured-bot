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
          
          // أ) الكورسات الكاملة (تعديل الاستعلام لجلب المواد)
          const { data: fullCourses } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( 
                id, title, code, teacher_id,
                teachers ( name ),
                subjects ( id, title )  // ✅ 1. تمت إضافة جلب المواد هنا
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

          fullCourses?.forEach(item => {
            if (item.courses) {
              // ✅ 2. تحويل المواد القادمة من قاعدة البيانات إلى القائمة المطلوبة
              const courseSubjects = item.courses.subjects?.map(sub => ({
                id: sub.id, 
                title: sub.title
              })) || [];

              libraryMap.set(item.courses.id, {
                type: 'course',
                id: item.courses.id,
                title: item.courses.title,
                code: item.courses.code,
                instructor: item.courses.teachers?.name || 'Instructor',
                teacherId: item.courses.teacher_id, 
                owned_subjects: courseSubjects // ✅ الآن نرسل القائمة الفعلية بدلاً من 'all'
              });
            }
          });

          singleSubjects?.forEach(item => {
            const subject = item.subjects;
            const parentCourse = subject?.courses;

            if (parentCourse) {
              if (libraryMap.has(parentCourse.id)) {
                const existingEntry = libraryMap.get(parentCourse.id);
                // إذا كان الكورس موجوداً مسبقاً كاشتراك كامل، لا نضيف المواد الفردية
                // لأن القائمة الكاملة موجودة بالفعل في الخطوة السابقة
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
