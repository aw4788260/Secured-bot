// pages/api/dashboard/teacher/stats.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error, status } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم التعامل معه داخل الدالة المساعدة

  try {
    const teacherId = user.teacherId;

    // 1. جلب أرقام الكورسات الخاصة بالمدرس
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId);

    const courseIds = courses?.map(c => c.id) || [];
    
    // 2. عدد الطلاب (الفريدين)
    const { count: studentsCount } = await supabase
      .from('user_course_access')
      .select('user_id', { count: 'exact', head: true })
      .in('course_id', courseIds);

    // 3. الأرباح (من الطلبات المقبولة لهذا المدرس فقط)
    // نعتمد الآن على العمود الجديد teacher_id الذي أضفناه
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
      students: studentsCount || 0,
      earnings: totalEarnings,
      courses: courses?.length || 0,
      pendingRequests: pendingRequests || 0,
      currency: 'EGP'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
