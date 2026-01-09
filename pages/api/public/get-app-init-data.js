import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let isLoggedIn = false;
  let library = []; // قائمة المكتبة

  try {
    // 1. التحقق من المستخدم وجلب اشتراكاته (IDs فقط)
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

          const { data: courseSubs } = await supabase.from('user_course_access').select('course_id').eq('user_id', userId);
          const { data: subjectSubs } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', userId);

          userAccess = {
            courses: courseSubs ? courseSubs.map(c => c.course_id.toString()) : [],
            subjects: subjectSubs ? subjectSubs.map(s => s.subject_id.toString()) : []
          };
        }
      }
    }

    // 2. ✅ بناء قائمة المكتبة (Shallow Library) - الكورسات والمواد المملوكة فقط
    if (isLoggedIn) {
        // أ) تجميع كل الكورسات المستهدفة (سواء اشتراك كامل أو مواد فردية)
        let targetCourseIds = new Set(userAccess.courses);

        if (userAccess.subjects.length > 0) {
            const { data: parentCourses } = await supabase
                .from('subjects')
                .select('course_id')
                .in('id', userAccess.subjects);
            
            parentCourses?.forEach(p => targetCourseIds.add(p.course_id.toString()));
        }

        const idsArray = Array.from(targetCourseIds);

        if (idsArray.length > 0) {
            // ب) جلب الكورسات مع المواد فقط (بدون Chapters أو Videos) ⚡️
            const { data: shallowCourses } = await supabase
                .from('courses')
                .select(`
                    *,
                    subjects (
                        id, title, price, sort_order
                    )
                `)
                .in('id', idsArray)
                .order('sort_order', { ascending: true });

            // ج) فلترة المواد داخل الذاكرة لعرض المملوك فقط
            library = shallowCourses.map(course => {
                const isFullOwned = userAccess.courses.includes(course.id.toString());
                
                // نأخذ المادة فقط إذا كان الكورس مملوكاً أو المادة نفسها مملوكة
                const mySubjects = (course.subjects || []).filter(sub => 
                    isFullOwned || userAccess.subjects.includes(sub.id.toString())
                ).map(sub => ({
                    ...sub,
                    isOwned: true
                    // ✅ لاحظ: لا يوجد chapters هنا، مما يجعل البيانات خفيفة جداً
                })).sort((a, b) => a.sort_order - b.sort_order);

                // نضيف الكورس للمكتبة فقط إذا كان يحتوي على مواد
                if (mySubjects.length > 0) {
                    return { ...course, subjects: mySubjects, isOwned: isFullOwned };
                }
                return null;
            }).filter(Boolean); // حذف القيم الفارغة
        }
    }

    // 3. جلب قائمة المتجر (بيانات وصفية فقط)
    const { data: courses, error } = await supabase
      .from('view_course_details')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,
      myAccess: userAccess,
      library: library,     // ✅ قائمة خفيفة للمكتبة
      courses: courses || [] // قائمة المتجر
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
