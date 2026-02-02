// pages/api/dashboard/super/stats.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const adminUser = await requireSuperAdmin(req, res);
  if (!adminUser) return;

  try {
    // استخدام Promise.all لتنفيذ جميع الاستعلامات في نفس الوقت (أسرع)
    const [teachersResult, studentsResult, revenueResult] = await Promise.all([
      // 1. إجمالي المدرسين
      supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true }),

      // 2. إجمالي الطلاب في المنصة
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),

      // 3. إجمالي المبيعات (باستخدام دالة الأدمن الجديدة)
      supabase.rpc('get_total_revenue')
    ]);

    // معالجة الأرباح (نظام الأمان الهجين)
    let totalRevenue = 0;

    if (!revenueResult.error) {
      // نجح الاستدعاء السريع
      totalRevenue = revenueResult.data || 0;
    } else {
      // فشل الاستدعاء السريع، نستخدم الحساب اليدوي كاحتياطي
      console.warn("⚠️ RPC Failed in super-stats, falling back to manual:", revenueResult.error.message);
      
      const { data: manualData } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('status', 'approved');
      
      totalRevenue = manualData?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;
    }

    return res.status(200).json({
      teachers: teachersResult.count || 0,
      students: studentsResult.count || 0,
      revenue: totalRevenue
    });

  } catch (err) {
    console.error("Super Admin Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
