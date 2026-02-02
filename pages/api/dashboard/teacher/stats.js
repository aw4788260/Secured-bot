import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (بنظام الداشبورد)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; 

  const teacherId = user.teacherId;

  try {
    // =========================================================
    // 2. جلب الكورسات والمواد (لحساب الطلاب)
    // =========================================================
    
    // أ. جلب الكورسات
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', teacherId);
    
    if (coursesError) throw coursesError;
    const courses = coursesData || [];
    const courseIds = courses.map(c => c.id);

    // ب. جلب المواد
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
    // 3. جلب صلاحيات الوصول (Students Only)
    // =========================================================
    
    // أ. مشتركو الكورسات (مع التأكد أنهم طلاب فقط)
    let courseAccess = [];
    if (courseIds.length > 0) {
      const { data: caData, error: caError } = await supabase
        .from('user_course_access')
        .select('course_id, user_id, users!inner(role)') 
        .in('course_id', courseIds)
        .eq('users.role', 'student'); 
      
      if (caError) throw caError;
      courseAccess = caData || [];
    }

    // ب. مشتركو المواد (مع التأكد أنهم طلاب فقط)
    let subjectAccess = [];
    if (subjectIds.length > 0) {
      const { data: saData, error: saError } = await supabase
        .from('user_subject_access')
        .select('subject_id, user_id, users!inner(role)') 
        .in('subject_id', subjectIds)
        .eq('users.role', 'student'); 
        
      if (saError) throw saError;
      subjectAccess = saData || [];
    }

    // =========================================================
    // 4. الحسابات النهائية وتفاصيل الأداء
    // =========================================================

    // تفاصيل للكورسات (للعرض في الجدول بالأسفل)
    const coursesStats = courses.map(course => ({
       id: course.id,
       title: course.title,
       count: courseAccess.filter(a => a.course_id === course.id).length
    }));

    // تفاصيل للمواد (للعرض في الجدول بالأسفل)
    const subjectsStats = subjects.map(subject => ({
       id: subject.id,
       title: subject.title,
       count: subjectAccess.filter(a => a.subject_id === subject.id).length
    }));

    // إجمالي الطلاب (بدون تكرار)
    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);
    const totalUniqueStudents = allStudentIds.size;

    // =========================================================
    // 5. حساب الأرباح (الطريقة المباشرة من الطلبات)
    // =========================================================
    
    const { data: earningsData, error: earnError } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('teacher_id', teacherId)
        .eq('status', 'approved');

    if (earnError) throw earnError;

    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    // عدد الطلبات المعلقة (مهم للصفحة الرئيسية)
    const { count: pendingRequests } = await supabase
      .from('subscription_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'pending');

    // =========================================================
    // 6. إرسال الرد
    // =========================================================
    return res.status(200).json({
      success: true,
      // البيانات الإجمالية للبطاقات العلوية
      summary: {
        students: totalUniqueStudents,
        earnings: totalEarnings,
        courses: courses.length,
        pending: pendingRequests || 0
      },
      // البيانات التفصيلية للجداول السفلية
      details: {
          courses: coursesStats,
          subjects: subjectsStats
      }
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
