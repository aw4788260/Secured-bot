// pages/api/dashboard/super/stats.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const adminUser = await requireSuperAdmin(req, res);
  if (!adminUser) return;

  try {
    // 1. إجمالي المدرسين
    const { count: teachersCount } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true });

    // 2. إجمالي الطلاب في المنصة
    const { count: studentsCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    // 3. إجمالي المبيعات (كل المنصة)
    const { data: earnings } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('status', 'approved');
      
    const totalRevenue = earnings?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;

    return res.status(200).json({
      teachers: teachersCount,
      students: studentsCount,
      revenue: totalRevenue
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
