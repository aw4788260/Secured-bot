import { supabase } from '../../../lib/supabaseClient';
import jwt from 'jsonwebtoken';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let libraryData = []; 
  let isLoggedIn = false;
  let userId = null;

  // 1. محاولة التعرف على المستخدم من التوكن (Soft Check)
  const authHeader = req.headers['authorization'];
  const deviceIdHeader = req.headers['x-device-id'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // تحقق أمني بسيط: يجب أن يطابق الجهاز المسجل في التوكن الجهاز المرسل في الهيدر
          if (decoded.deviceId === deviceIdHeader) {
              userId = decoded.userId;
          }
      } catch (e) {
          // توكن غير صالح أو منتهي -> نعتبره زائر ونكمل
          console.log("Init Data: Invalid/Expired Token or Guest Access");
      }
  }

  try {
    // 2. إذا تم التعرف على المستخدم، نجلب بياناته الخاصة
    if (userId) {
       // ✅ التحديث هنا: جلب الصلاحية ورقم بروفايل المعلم
       const { data: user } = await supabase
          .from('users')
          .select('id, first_name, username, phone, is_blocked, jwt_token, role, teacher_profile_id')
          .eq('id', userId)
          .single();

       // يجب أن يكون المستخدم موجوداً، غير محظور، والتوكن مطابق (لضمان عدم تسجيل الخروج)
       const incomingToken = authHeader.split(' ')[1];
       
       if (user && !user.is_blocked && user.jwt_token === incomingToken) {
          // ✅ التحديث هنا: إضافة البيانات الجديدة للكائن المرسل للتطبيق
          userData = {
              id: user.id,
              first_name: user.first_name,
              username: user.username,
              phone: user.phone,
              role: user.role || 'student', // الافتراضي طالب
              teacher_profile_id: user.teacher_profile_id
          };
          isLoggedIn = true;

          // ==========================================
          // منطق المكتبة (Library Logic)
          // ==========================================

          // أ) جلب الكورسات الكاملة
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

          // ب) جلب مواد هذه الكورسات
          let courseSubjectsMap = {};
          if (fullCourses && fullCourses.length > 0) {
            const courseIds = fullCourses.map(item => item.course_id);
            const { data: allSubjects } = await supabase
                .from('subjects')
                .select('id, title, course_id, sort_order')
                .in('course_id', courseIds)
                .order('sort_order', { ascending: true }); 

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

          // هيكلة الصلاحيات
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          const libraryMap = new Map();

          // إضافة الكورسات للمكتبة
          fullCourses?.forEach(item => {
            if (item.courses) {
              const cId = item.courses.id;
              const subjectsList = courseSubjectsMap[cId] || [];
              libraryMap.set(cId, {
                type: 'course',
                id: cId,
                title: item.courses.title,
                code: item.courses.code,
                instructor: item.courses.teachers?.name || 'Instructor',
                teacherId: item.courses.teacher_id, 
                owned_subjects: subjectsList
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

    // 3. جلب بيانات المتجر (عام للجميع)
    // ملاحظة: يمكنك هنا لاحقاً استثناء كورسات المدرس نفسه من الظهور في المتجر له إذا أردت
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
