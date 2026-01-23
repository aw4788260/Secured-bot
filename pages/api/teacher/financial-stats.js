import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من أن المستخدم مدرس
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  try {
    // ---------------------------------------------------------
    // 2. جلب الكورسات الخاصة بالمدرس
    // ---------------------------------------------------------
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', teacherId);
    
    if (coursesError) throw coursesError;
    const courses = coursesData || []; 
    const courseIds = courses.map(c => c.id);

    // ---------------------------------------------------------
    // 3. جلب المواد (Subjects) المرتبطة بهذه الكورسات
    // ---------------------------------------------------------
    // بما أن جدول subjects لا يحتوي على teacher_id، نجلب المواد التابعة لكورسات هذا المدرس
    let subjects = [];
    let subjectIds = [];

    if (courseIds.length > 0) {
        // ✅ تصحيح: استخدام title بدلاً من name
        // ✅ تصحيح: الجلب بدلالة course_id لأن teacher_id غير موجود في جدول subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, title') 
          .in('course_id', courseIds);

        if (subjectsError) throw subjectsError;
        subjects = subjectsData || [];
        subjectIds = subjects.map(s => s.id);
    }

    // ---------------------------------------------------------
    // 4. جلب صلاحيات الوصول (الطلاب المشتركين)
    // ---------------------------------------------------------
    
    // أ. الطلاب المشتركون في الكورسات (Full Course)
    let courseAccess = [];
    if (courseIds.length > 0) {
      const { data: caData, error: caError } = await supabase
        .from('user_course_access')
        .select('course_id, user_id')
        .in('course_id', courseIds);
      
      if (caError) throw caError;
      courseAccess = caData || [];
    }

    // ب. الطلاب المشتركون في المواد (Single Subject)
    let subjectAccess = [];
    if (subjectIds.length > 0) {
      const { data: saData, error: saError } = await supabase
        .from('user_subject_access')
        .select('subject_id, user_id')
        .in('subject_id', subjectIds);
        
      if (saError) throw saError;
      subjectAccess = saData || [];
    }

    // ---------------------------------------------------------
    // 5. معالجة البيانات للإحصائيات التفصيلية
    // ---------------------------------------------------------

    const coursesStats = courses.map(course => {
      const count = courseAccess.filter(a => a.course_id === course.id).length;
      return { title: course.title, count };
    });

    const subjectsStats = subjects.map(subject => {
      const count = subjectAccess.filter(a => a.subject_id === subject.id).length;
      // ✅ تصحيح: استخدام subject.title هنا أيضاً
      return { title: subject.title, count }; 
    });

    // ---------------------------------------------------------
    // 6. حساب إجمالي الطلاب (Unique Students)
    // ---------------------------------------------------------
    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);
    
    const totalUniqueStudents = allStudentIds.size;

    // ---------------------------------------------------------
    // 7. حساب الأرباح (من الطلبات المقبولة)
    // ---------------------------------------------------------
    let totalEarnings = 0;
    
    if (courseIds.length > 0 || subjectIds.length > 0) {
        // جلب الطلبات المقبولة فقط
        const { data: allRequests, error: reqError } = await supabase
            .from('subscription_requests')
            .select('total_price, course_id, subject_id')
            .eq('status', 'approved');
        
        if (reqError) throw reqError;

        const requests = allRequests || [];

        // فلترة الطلبات الخاصة بهذا المدرس فقط
        const myRequests = requests.filter(r => 
            (r.course_id && courseIds.includes(r.course_id)) || 
            (r.subject_id && subjectIds.includes(r.subject_id))
        );

        totalEarnings = myRequests.reduce((sum, item) => sum + (item.total_price || 0), 0);
    }

    // ---------------------------------------------------------
    // 8. إرسال الرد النهائي
    // ---------------------------------------------------------
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
