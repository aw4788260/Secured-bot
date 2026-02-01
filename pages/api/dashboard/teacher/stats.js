import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم التعامل معه داخل الدالة المساعدة

  try {
    const teacherId = user.teacherId;

    // 1. جلب أرقام الكورسات والمواد الخاصة بالمدرس
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId);

    const courseIds = courses?.map(c => c.id) || [];

    // جلب المواد التابعة للكورسات (لحساب طلاب المواد الفردية)
    let subjectIds = [];
    if (courseIds.length > 0) {
        const { data: subjects } = await supabase
            .from('subjects')
            .select('id')
            .in('course_id', courseIds);
        subjectIds = subjects?.map(s => s.id) || [];
    }

    // 2. حساب عدد الطلاب (الفريدين) بدقة
    // نستخدم Set لضمان عدم تكرار الطالب إذا اشترى أكثر من شي
    const uniqueStudentIds = new Set();

    // أ) المشتركون في الكورسات
    if (courseIds.length > 0) {
        const { data: courseUsers } = await supabase
            .from('user_course_access')
            .select('user_id')
            .in('course_id', courseIds);
        
        courseUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // ب) المشتركون في المواد الفردية
    if (subjectIds.length > 0) {
        const { data: subjectUsers } = await supabase
            .from('user_subject_access')
            .select('user_id')
            .in('subject_id', subjectIds);

        subjectUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // 3. الأرباح (من الطلبات المقبولة في جدول subscription_requests)
    // هذا هو المصدر الأدق للأموال المحصلة فعلياً
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('teacher_id', teacherId)
      .eq('status', 'approved');

    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    // 4. عدد الطلبات المعلقة
    const { count: pendingRequests } = await supabase
      .from('subscription_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'pending');

    return res.status(200).json({
      students: uniqueStudentIds.size || 0, // العدد الفريد
      earnings: totalEarnings,
      courses: courses?.length || 0,
      pendingRequests: pendingRequests || 0,
      currency: 'EGP'
    });

  } catch (err) {
    console.error("Stats API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
