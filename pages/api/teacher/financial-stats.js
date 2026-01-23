import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من أن المستخدم مدرس
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  try {
    // =========================================================
    // 2. جلب الكورسات والمواد الخاصة بالمدرس
    // =========================================================
    
    // أ. جلب الكورسات (Courses)
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', teacherId);
    
    if (coursesError) throw coursesError;
    const courses = coursesData || [];
    const courseIds = courses.map(c => c.id);

    // ب. جلب المواد (Subjects) المرتبطة بهذه الكورسات
    let subjects = [];
    let subjectIds = [];

    if (courseIds.length > 0) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, title') 
          .in('course_id', courseIds);

        if (subjectsError) throw subjectsError;
        subjects = subjectsData || [];
        subjectIds = subjects.map(s => s.id);
    }

    // =========================================================
    // 3. جلب صلاحيات الوصول (مع فلترة الطلاب فقط)
    // =========================================================
    
    // أ. الطلاب المشتركون في الكورسات (Full Course)
    let courseAccess = [];
    if (courseIds.length > 0) {
      const { data: caData, error: caError } = await supabase
        .from('user_course_access')
        .select('course_id, user_id, users!inner(role)') // 🔹 Join داخلي
        .in('course_id', courseIds)
        .eq('users.role', 'student'); // 🔹 شرط: أن يكون الدور 'student' فقط
      
      if (caError) throw caError;
      courseAccess = caData || [];
    }

    // ب. الطلاب المشتركون في المواد (Single Subject)
    let subjectAccess = [];
    if (subjectIds.length > 0) {
      const { data: saData, error: saError } = await supabase
        .from('user_subject_access')
        .select('subject_id, user_id, users!inner(role)') // 🔹 Join داخلي
        .in('subject_id', subjectIds)
        .eq('users.role', 'student'); // 🔹 شرط: أن يكون الدور 'student' فقط
        
      if (saError) throw saError;
      subjectAccess = saData || [];
    }

    // =========================================================
    // 4. معالجة بيانات الطلاب للإحصائيات
    // =========================================================

    // بما أننا قمنا بفلترة courseAccess و subjectAccess أعلاه،
    // فإن الأرقام هنا ستعكس الطلاب فقط (بدون المعلمين والمشرفين)
    const coursesStats = courses.map(course => {
      const count = courseAccess.filter(a => a.course_id === course.id).length;
      return { title: course.title, count };
    });

    const subjectsStats = subjects.map(subject => {
      const count = subjectAccess.filter(a => a.subject_id === subject.id).length;
      return { title: subject.title, count };
    });

    // حساب إجمالي الطلاب (بدون تكرار)
    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);
    const totalUniqueStudents = allStudentIds.size;

    // =========================================================
    // 5. حساب الأرباح (من الطلبات المقبولة)
    // =========================================================
    // ملاحظة: الأرباح تُحسب بناءً على الأموال المدفوعة في الطلبات المقبولة
    let totalEarnings = 0;

    const { data: requestsData, error: reqError } = await supabase
        .from('subscription_requests')
        .select('requested_data')
        .eq('status', 'approved');

    if (reqError) throw reqError;

    const requests = requestsData || [];

    requests.forEach(req => {
        const items = req.requested_data; 
        
        if (Array.isArray(items)) {
            items.forEach(item => {
                const price = Number(item.price) || 0;
                
                // إذا كان العنصر كورس وموجود ضمن كورسات المدرس
                if (item.type === 'course' && courseIds.includes(item.id)) {
                    totalEarnings += price;
                }
                // إذا كان العنصر مادة وموجودة ضمن مواد المدرس
                else if (item.type === 'subject' && subjectIds.includes(item.id)) {
                    totalEarnings += price;
                }
            });
        }
    });

    // =========================================================
    // 6. إرسال الرد
    // =========================================================
    return res.status(200).json({
      totalUniqueStudents,
      totalEarnings,
      coursesStats,
      subjectsStats
    });

  } catch (err) {
    console.error("Financial Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
