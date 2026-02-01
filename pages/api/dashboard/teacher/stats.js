import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; 

  try {
    const teacherId = user.teacherId;
    console.log(`🔍 [StatsAPI] Calculating for Teacher ID: ${teacherId}`);

    // 1. جلب الكورسات والمواد (لحساب الطلاب)
    const { data: courses } = await supabase.from('courses').select('id').eq('teacher_id', teacherId);
    const courseIds = courses?.map(c => c.id) || [];

    let subjectIds = [];
    if (courseIds.length > 0) {
        const { data: subjects } = await supabase.from('subjects').select('id').in('course_id', courseIds);
        subjectIds = subjects?.map(s => s.id) || [];
    }

    // 2. حساب الطلاب الفريدين
    const uniqueStudentIds = new Set();
    if (courseIds.length > 0) {
        const { data: cUsers } = await supabase.from('user_course_access').select('user_id').in('course_id', courseIds);
        cUsers?.forEach(u => uniqueStudentIds.add(u.user_id));
    }
    if (subjectIds.length > 0) {
        const { data: sUsers } = await supabase.from('user_subject_access').select('user_id').in('subject_id', subjectIds);
        sUsers?.forEach(u => uniqueStudentIds.add(u.user_id));
    }

    // 3. الأرباح (التركيز هنا)
    const { data: earningsData, error: earnError } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('teacher_id', teacherId) // تأكد أن هذا العمود ممتلئ في قاعدة البيانات
      .eq('status', 'approved');

    if (earnError) console.error("❌ [StatsAPI] Earnings DB Error:", earnError.message);

    // حساب المجموع
    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
    
    // طباعة النتيجة في التيرمينال للتأكد
    console.log(`💰 [StatsAPI] Found ${earningsData?.length || 0} approved requests. Total Earnings: ${totalEarnings}`);

    // 4. الطلبات المعلقة
    const { count: pendingRequests } = await supabase
      .from('subscription_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'pending');

    // تجهيز البيانات
    const statsPayload = {
        students: uniqueStudentIds.size || 0,
        earnings: totalEarnings,
        courses: courses?.length || 0,
        pendingRequests: pendingRequests || 0,
        views: 0,
        currency: 'EGP'
    };

    // إرسال الرد بصيغة "هجينة" تدعم كل التنسيقات المتوقعة
    return res.status(200).json({
      success: true,
      ...statsPayload, // الصيغة المباشرة (data.earnings)
      stats: statsPayload // الصيغة المتداخلة (data.stats.earnings)
    });

  } catch (err) {
    console.error("🔥 [StatsAPI] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
