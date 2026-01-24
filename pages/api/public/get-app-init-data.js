import { supabase } from '../../../lib/supabaseClient';
import jwt from 'jsonwebtoken';

export default async (req, res) => {
  const logPrefix = `[InitData ${new Date().toISOString().split('T')[1].split('.')[0]}]`; // توقيت لسهولة التتبع
  console.log(`${logPrefix} 🚀 Request received`);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let libraryData = []; 
  let isLoggedIn = false;
  let userId = null;

  // 1. محاولة التعرف على المستخدم
  const authHeader = req.headers['authorization'];
  const deviceIdHeader = req.headers['x-device-id'];
  
  console.log(`${logPrefix} Headers -> Auth: ${!!authHeader}, DeviceID: ${deviceIdHeader}`);

  if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          // console.log(`${logPrefix} Token Decoded -> UserID: ${decoded.userId}, DeviceID: ${decoded.deviceId}`);

          if (decoded.deviceId === deviceIdHeader) {
              userId = decoded.userId;
              console.log(`${logPrefix} ✅ User Verified from Token: ${userId}`);
          } else {
              console.warn(`${logPrefix} ⚠️ Device Mismatch! Token: ${decoded.deviceId} != Header: ${deviceIdHeader}`);
          }
      } catch (e) {
          console.error(`${logPrefix} ❌ Token Error: ${e.message}`);
      }
  }

  try {
    // 2. إذا تم التعرف على المستخدم
    if (userId) {
       console.log(`${logPrefix} 🔍 Fetching User DB Data...`);
       const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, first_name, username, phone, is_blocked, jwt_token, role, teacher_profile_id')
          .eq('id', userId)
          .single();

       if (userError) console.error(`${logPrefix} ❌ DB User Fetch Error: ${userError.message}`);

       const incomingToken = authHeader.split(' ')[1];
       
       if (user && !user.is_blocked && user.jwt_token === incomingToken) {
          console.log(`${logPrefix} ✅ User DB Validated. Role: ${user.role}, TeacherID: ${user.teacher_profile_id}`);

          // جلب الصورة
          let profileImage = null;
          if (user.teacher_profile_id) {
             const { data: teacherData } = await supabase
                .from('teachers')
                .select('profile_image')
                .eq('id', user.teacher_profile_id)
                .single();
             
             if (teacherData && teacherData.profile_image) {
                profileImage = teacherData.profile_image;
                if (!profileImage.startsWith('http')) {
                    profileImage = `https://courses.aw478260.dpdns.org/api/public/get-avatar?file=${profileImage}`;
                }
             }
          }

          const appRole = (user.role === 'moderator' || user.role === 'teacher') ? 'teacher' : (user.role || 'student');

          userData = {
              id: user.id,
              first_name: user.first_name,
              username: user.username,
              phone: user.phone,
              role: appRole, 
              teacher_profile_id: user.teacher_profile_id,
              profile_image: profileImage
          };
          isLoggedIn = true;

          // ==========================================
          // منطق المكتبة (Library Logic)
          // ==========================================
          console.log(`${logPrefix} 📚 Starting Library Fetch...`);

          // أ) جلب الكورسات الكاملة
          const { data: fullCourses, error: courseError } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( 
                id, title, code, teacher_id,
                teachers ( name )
              )
            `)
            .eq('user_id', userId);
          
          if (courseError) console.error(`${logPrefix} ❌ Course Access Error: ${courseError.message}`);
          console.log(`${logPrefix} 📦 Full Courses Found: ${fullCourses?.length || 0}`);

          // ب) جلب مواد هذه الكورسات
          let courseSubjectsMap = {};
          if (fullCourses && fullCourses.length > 0) {
            const courseIds = fullCourses.map(item => item.course_id);
            // console.log(`${logPrefix} Fetching subjects for CourseIDs: ${courseIds}`);
            
            const { data: allSubjects } = await supabase
                .from('subjects')
                .select('id, title, course_id, sort_order')
                .in('course_id', courseIds)
                .order('sort_order', { ascending: true }); 

            console.log(`${logPrefix} 📄 Total Subjects for Courses: ${allSubjects?.length || 0}`);

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
            
          console.log(`${logPrefix} 📎 Single Subjects Found: ${singleSubjects?.length || 0}`);

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
            } else {
                console.warn(`${logPrefix} ⚠️ Found access for course_id ${item.course_id} but 'courses' data is null (Content Deleted?)`);
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
          console.log(`${logPrefix} 🏁 Final Library Items count: ${libraryData.length}`);
       } else {
           console.log(`${logPrefix} ⛔ User validation failed (Blocked or Token changed)`);
       }
    }

    // 3. جلب بيانات المتجر
    console.log(`${logPrefix} 🛒 Fetching Market Courses...`);
    const { data: courses } = await supabase
      .from('view_course_details')
      .select('*')
      .order('sort_order', { ascending: true });

    // بناء الاستجابة النهائية
    const responsePayload = {
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,         
      myAccess: userAccess, 
      library: libraryData, 
      courses: courses || [] 
    };

    // ✅ طباعة الرد النهائي في اللوج (ملخص)
    console.log(`${logPrefix} 📤 SENDING RESPONSE:`);
    console.log(JSON.stringify({
        success: responsePayload.success,
        isLoggedIn: responsePayload.isLoggedIn,
        libraryCount: responsePayload.library.length,
        myCourseIds: responsePayload.myAccess.courses,
        marketCoursesCount: responsePayload.courses.length
    }, null, 2));

    return res.status(200).json(responsePayload);

  } catch (err) {
    console.error(`${logPrefix} 💥 FATAL ERROR:`, err.message);
    console.error(err.stack);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
