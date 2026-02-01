import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (نظام الداشبورد)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم إرساله مسبقاً

  const teacherId = user.teacherId;

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
    
    // أ. الطلاب المشتركون في الكورسات
    let courseAccess = [];
    if (courseIds.length > 0) {
      const { data: caData, error: caError } = await supabase
        .from('user_course_access')
        .select('course_id, user_id, users!inner(role)') // Join داخلي للتأكد من الدور
        .in('course_id', courseIds)
        .eq('users.role', 'student'); // 🔹 شرط: أن يكون الدور 'student'
      
      if (caError) throw caError;
      courseAccess = caData || [];
    }

    // ب. الطلاب المشتركون في المواد
    let subjectAccess = [];
    if (subjectIds.length > 0) {
      const { data: saData, error: saError } = await supabase
        .from('user_subject_access')
        .select('subject_id, user_id, users!inner(role)')
        .in('subject_id', subjectIds)
        .eq('users.role', 'student'); // 🔹 شرط: أن يكون الدور 'student'
        
      if (saError) throw saError;
      subjectAccess = saData || [];
    }

    // =========================================================
    // 4. معالجة بيانات الطلاب للإحصائيات
    // =========================================================

    // إحصائيات الكورسات (عدد الطلاب لكل كورس)
    const coursesStats = courses.map(course => {
      const count = courseAccess.filter(a => a.course_id === course.id).length;
      return { title: course.title, count };
    });

    // إحصائيات المواد (عدد الطلاب لكل مادة)
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
    // 5. حساب الأرباح (من جدول subscription_requests)
    // =========================================================
    let totalEarnings = 0;

    // نجلب الطلبات المقبولة لهذا المعلم فقط
    const { data: requests, error: reqError } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('teacher_id', teacherId)
        .eq('status', 'approved');

    if (reqError) throw reqError;

    // جمع الأرباح
    if (requests && requests.length > 0) {
        totalEarnings = requests.reduce((sum, req) => sum + (req.total_price || 0), 0);
    }

    // =========================================================
    // 6. إرسال الرد
    // =========================================================
    // نقوم بتنسيق الرد ليتوافق مع ما تتوقعه الصفحة الرئيسية (Home)
    return res.status(200).json({
      success: true,
      stats: {
          students: totalUniqueStudents,
          courses: courses.length,
          earnings: totalEarnings,
          views: 0 // (Placeholder)
      },
      // بيانات إضافية للرسوم البيانية (إن وجدت)
      charts: {
          courses: coursesStats,
          subjects: subjectsStats
      }
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
