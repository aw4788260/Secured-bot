import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // استقبال الهيدرز من التطبيق
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let libraryData = []; // ✅ الهيكل الجديد للمكتبة
  let isLoggedIn = false;

  try {
    // 1. التحقق من هوية المستخدم (إذا وجدت بيانات)
    if (userId && deviceId) {
      const { data: deviceCheck } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

      // التحقق من تطابق بصمة الجهاز
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
          // ✅ التعديل الجديد: جلب تفاصيل المكتبة (اشتراكات كاملة + منفصلة)
          // -----------------------------------------------------------

          // أ) جلب الكورسات الكاملة (يملك الكورس بالكامل)
          const { data: fullCourses } = await supabase
            .from('user_course_access')
            .select(`
              course_id,
              courses ( id, title, code, instructor_name )
            `)
            .eq('user_id', userId);

          // ب) جلب المواد المنفصلة (يملك مواد محددة) + جلب بيانات الكورس الأب
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

          // ج) تحديث مصفوفات الوصول السريعة (للاستخدام القديم if needed)
          userAccess = {
            courses: fullCourses ? fullCourses.map(c => c.course_id.toString()) : [],
            subjects: singleSubjects ? singleSubjects.map(s => s.subject_id.toString()) : []
          };

          // د) معالجة البيانات لإنشاء هيكل المكتبة الموحد
          const libraryMap = new Map();

          // 1. إضافة الكورسات الكاملة
          fullCourses?.forEach(item => {
            if (item.courses) {
              libraryMap.set(item.courses.id, {
                type: 'course', // نوع الاشتراك: كورس كامل
                id: item.courses.id,
                title: item.courses.title,
                code: item.courses.code,
                instructor: item.courses.instructor_name || 'Instructor',
                owned_subjects: 'all' // علامة تعني أنه يملك الكل
              });
            }
          });

          // 2. إضافة المواد المنفصلة (مع دمجها تحت الكورس الخاص بها)
          singleSubjects?.forEach(item => {
            const subject = item.subjects;
            const parentCourse = subject?.courses;

            if (parentCourse) {
              // إذا كان الكورس موجوداً بالفعل في القائمة (سواء كامل أو مضاف له مواد سابقاً)
              if (libraryMap.has(parentCourse.id)) {
                const existingEntry = libraryMap.get(parentCourse.id);
                
                // إذا لم يكن الاشتراك كاملاً، نضيف المادة للقائمة
                if (existingEntry.owned_subjects !== 'all') {
                  existingEntry.owned_subjects.push({
                    id: subject.id,
                    title: subject.title
                  });
                }
              } else {
                // إذا لم يكن الكورس موجوداً، ننشئه ونضيف المادة له
                libraryMap.set(parentCourse.id, {
                  type: 'subject_group', // نوع الاشتراك: تجميع مواد
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

          // تحويل الـ Map إلى Array
          libraryData = Array.from(libraryMap.values());
        }
      }
    }

    // 2. جلب قائمة الكورسات العامة (للمتجر - Metadata فقط)
    const { data: courses, error } = await supabase
      .from('view_course_details') // تأكد من وجود هذا الـ View أو استخدم الجدول مباشرة
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // 3. الرد النهائي
    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,       
      myAccess: userAccess, // القائمة القديمة (IDs فقط)
      library: libraryData, // ✅ القائمة الجديدة (هيكل كامل للعرض)
      courses: courses || [] 
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
