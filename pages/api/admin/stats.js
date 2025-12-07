import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  try {
    // 1. عدد الطلبات المعلقة
    const { count: pendingCount } = await supabase
      .from('subscription_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 2. عدد الطلاب
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', false);

    // 3. عدد الكورسات
    const { count: coursesCount } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    // 4. [جديد] حساب إجمالي الأرباح (للطلبات المقبولة فقط)
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('status', 'approved');

    // جمع المبالغ
    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    res.status(200).json({ 
        requests: pendingCount || 0, 
        users: usersCount || 0, 
        courses: coursesCount || 0,
        earnings: totalEarnings // القيمة الجديدة
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
