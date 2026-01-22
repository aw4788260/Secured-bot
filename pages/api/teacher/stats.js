import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const teacherId = auth.teacherId;

    // 1. جلب أرقام الكورسات الخاصة بالمدرس
    const { data: courses } = await supabase
      .from('courses')
      .select('id, price')
      .eq('teacher_id', teacherId);

    const courseIds = courses?.map(c => c.id) || [];
    
    // 2. حساب عدد الطلاب المشتركين (الفريدين)
    // نعد الصفوف في جدول الصلاحيات للكورسات التي يملكها المدرس
    const { count: studentsCount, error: countErr } = await supabase
      .from('user_course_access')
      .select('user_id', { count: 'exact', head: true })
      .in('course_id', courseIds);

    // 3. حساب الأرباح (تقريبي بناءً على الطلبات المقبولة)
    // نجمع أسعار الطلبات التي حالتها 'approved' وتخص كورسات المدرس
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .in('course_id', courseIds)
      .eq('status', 'approved');

    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    // 4. إحصائيات سريعة (عدد الكورسات، عدد الامتحانات)
    const coursesCount = courses?.length || 0;
    
    // عدد الامتحانات المرتبطة بمواد هذا المدرس
    // هذا يتطلب Query معقد قليلاً، لذا يمكن تجاهله الآن لتسريع الأداء أو جلبه بشكل منفصل

    return res.status(200).json({
      students: studentsCount || 0,
      earnings: totalEarnings,
      courses: coursesCount,
      currency: 'EGP'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
