import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; 

  const teacherId = user.teacherId;

  try {
    // 1. التنفيذ المتوازي للكورسات والطلبات المعلقة
    const [coursesResult, pendingResult] = await Promise.all([
      supabase.from('courses').select('id, title').eq('teacher_id', teacherId),
      supabase.from('subscription_requests').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId).eq('status', 'pending')
    ]);

    // 2. محاولة حساب الأرباح (نظام ذكي: يحاول السريع، وإذا فشل يستخدم الدقيق)
    let totalEarnings = 0;
    
    // المحاولة الأولى: عبر دالة قاعدة البيانات (الأسرع)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_teacher_revenue', { teacher_uuid: teacherId });

    if (!rpcError) {
        totalEarnings = rpcData;
    } else {
        // إذا حدث خطأ (مثلاً الدالة غير موجودة)، نقوم بالحساب بالطريقة القديمة ونطبع الخطأ
        console.warn("⚠️ RPC Failed, falling back to manual calculation:", rpcError.message);
        
        const { data: manualData } = await supabase
            .from('subscription_requests')
            .select('total_price')
            .eq('teacher_id', teacherId)
            .eq('status', 'approved');
            
        totalEarnings = manualData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
    }

    // استكمال باقي البيانات
    const courses = coursesResult.data || [];
    const courseIds = courses.map(c => c.id);
    const pendingRequests = pendingResult.count || 0;

    // ... (باقي كود جلب المواد والطلاب كما هو) ...
    // ... يفضل نسخ الجزء الخاص بالمواد والطلاب من الرد السابق ولصقه هنا ...
    
    // للتوضيح: سنكمل الجزئية الناقصة لضمان عمل الملف
    let subjects = [];
    let subjectIds = [];
    if (courseIds.length > 0) {
        const { data } = await supabase.from('subjects').select('id, title').in('course_id', courseIds);
        subjects = data || [];
        subjectIds = subjects.map(s => s.id);
    }

    const [courseAccessResult, subjectAccessResult] = await Promise.all([
        courseIds.length > 0 ? supabase.from('user_course_access').select('course_id, user_id').in('course_id', courseIds) : { data: [] },
        subjectIds.length > 0 ? supabase.from('user_subject_access').select('subject_id, user_id').in('subject_id', subjectIds) : { data: [] }
    ]);

    const courseAccess = courseAccessResult.data || [];
    const subjectAccess = subjectAccessResult.data || [];

    const coursesStats = courses.map(c => ({
       id: c.id, 
       title: c.title, 
       count: courseAccess.filter(a => a.course_id === c.id).length
    }));

    const subjectsStats = subjects.map(s => ({
       id: s.id, 
       title: s.title, 
       count: subjectAccess.filter(a => a.subject_id === s.id).length
    }));

    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        students: allStudentIds.size,
        earnings: totalEarnings, // الآن سيحمل القيمة الصحيحة سواء من RPC أو الحساب اليدوي
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
