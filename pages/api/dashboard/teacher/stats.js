import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; 

  const teacherId = user.teacherId;

  try {
    // =========================================================
    // 2. التنفيذ المتوازي (Parallel Execution)
    // نجلب الكورسات، الطلبات المعلقة، والأرباح في وقت واحد
    // =========================================================
    
    const [coursesResult, pendingResult, revenueResult] = await Promise.all([
      // أ. جلب الكورسات
      supabase
        .from('courses')
        .select('id, title')
        .eq('teacher_id', teacherId),

      // ب. عدد الطلبات المعلقة (Count فقط)
      supabase
        .from('subscription_requests')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('status', 'pending'),

      // ج. حساب الأرباح (عبر دالة قاعدة البيانات الجديدة)
      // نستخدم اسم المتغير "teacher_id_arg" ليتطابق مع تعريف دالة SQL
      supabase.rpc('get_teacher_revenue', { teacher_id_arg: teacherId })
    ]);

    // التحقق من الأخطاء في البيانات الأساسية
    if (coursesResult.error) throw coursesResult.error;

    // معالجة الأرباح (Fallback Logic)
    let totalEarnings = 0;
    if (!revenueResult.error) {
        totalEarnings = revenueResult.data || 0;
    } else {
        console.warn("⚠️ RPC Failed, falling back to manual calculation:", revenueResult.error.message);
        // الحساب اليدوي كاحتياطي
        const { data: manualData } = await supabase
            .from('subscription_requests')
            .select('total_price')
            .eq('teacher_id', teacherId)
            .eq('status', 'approved');
            
        totalEarnings = manualData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
    }

    // استخراج البيانات الأساسية
    const courses = coursesResult.data || [];
    const courseIds = courses.map(c => c.id);
    const pendingRequests = pendingResult.count || 0;

    // =========================================================
    // 3. جلب المواد (Subjects) المرتبطة بالكورسات
    // =========================================================
    
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
    // 4. جلب بيانات الطلاب (مع استثناء المدرسين والمشرفين)
    // =========================================================
    
    const [courseAccessResult, subjectAccessResult] = await Promise.all([
        // أ. مشتركو الكورسات (فقط من لديهم دور student)
        courseIds.length > 0 ? 
            supabase
            .from('user_course_access')
            // users!inner تجبر الاستعلام على التحقق من جدول المستخدمين
            .select('course_id, user_id, users!inner(role)') 
            .in('course_id', courseIds)
            .eq('users.role', 'student') // 👈 هذا السطر يستثني المدرس والمشرفين
            : { data: [] },

        // ب. مشتركو المواد (فقط من لديهم دور student)
        subjectIds.length > 0 ?
            supabase
            .from('user_subject_access')
            .select('subject_id, user_id, users!inner(role)') 
            .in('subject_id', subjectIds)
            .eq('users.role', 'student') // 👈 هذا السطر يستثني المدرس والمشرفين
            : { data: [] }
    ]);

    if (courseAccessResult.error) throw courseAccessResult.error;
    if (subjectAccessResult.error) throw subjectAccessResult.error;

    const courseAccess = courseAccessResult.data || [];
    const subjectAccess = subjectAccessResult.data || [];

    // =========================================================
    // 5. الحسابات النهائية وتجهيز الرد
    // =========================================================

    // تفاصيل للكورسات
    const coursesStats = courses.map(course => ({
       id: course.id,
       title: course.title,
       count: courseAccess.filter(a => a.course_id === course.id).length
    }));

    // تفاصيل للمواد
    const subjectsStats = subjects.map(subject => ({
       id: subject.id,
       title: subject.title,
       count: subjectAccess.filter(a => a.subject_id === subject.id).length
    }));

    // إجمالي الطلاب الفريدين
    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        students: allStudentIds.size, // الآن هذا الرقم نظيف (طلاب فقط)
        earnings: totalEarnings,
        courses: courses.length,
        pending: pendingRequests
      },
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
