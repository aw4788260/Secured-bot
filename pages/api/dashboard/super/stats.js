import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  try {
    // تحديد تاريخ قبل 7 أيام
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateLimit = sevenDaysAgo.toISOString();

    // استخدام Promise.all لتنفيذ جميع الاستعلامات في نفس الوقت
    const [
        studentsResult, 
        teachersResult, 
        coursesResult, 
        revenueRpcResult,
        recentUsersResult,
        chartDataResult // ✅ استعلام جديد للرسم البياني
    ] = await Promise.all([
      // 1. إجمالي الطلاب
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),

      // 2. إجمالي المدرسين
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),

      // 3. الكورسات النشطة
      supabase.from('courses').select('*', { count: 'exact', head: true }),

      // 4. إجمالي المبيعات الكلي (RPC)
      supabase.rpc('get_total_revenue'),

      // 5. أحدث المسجلين
      supabase
        .from('users')
        .select('id, first_name, username, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5),

      // 6. ✅ بيانات الرسم البياني (أرباح آخر 7 أيام)
      supabase
        .from('subscription_requests')
        .select('created_at, total_price')
        .eq('status', 'approved')
        .gte('created_at', dateLimit)
    ]);

    // --- معالجة الأرباح الكلية ---
    let totalRevenue = 0;
    if (!revenueRpcResult.error) {
      totalRevenue = revenueRpcResult.data || 0;
    } else {
      // Fallback calculation
      const { data: manualData } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('status', 'approved');
      totalRevenue = manualData?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;
    }

    // --- معالجة بيانات الرسم البياني (تجميع الأرباح يومياً) ---
    const last7Days = [];
    const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const rawChartData = chartDataResult.data || [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0]; // صيغة YYYY-MM-DD للمقارنة
        const dayName = daysMap[d.getDay()]; // اسم اليوم بالعربي
        
        // جمع أرباح هذا اليوم
        const dayTotal = rawChartData
            .filter(item => item.created_at.startsWith(dateStr))
            .reduce((sum, item) => sum + (item.total_price || 0), 0);
            
        last7Days.push({ name: dayName, sales: dayTotal });
    }

    // --- تنسيق المستخدمين الجدد ---
    const formattedRecentUsers = recentUsersResult.data 
        ? recentUsersResult.data.map(u => ({
            id: u.id,
            name: u.first_name || u.username || 'مستخدم جديد',
            role: u.role,
            date: u.created_at
          })) 
        : [];

    return res.status(200).json({
      success: true,
      totalUsers: studentsResult.count || 0,
      totalTeachers: teachersResult.count || 0,
      activeCourses: coursesResult.count || 0,
      totalRevenue: totalRevenue,
      recentUsers: formattedRecentUsers,
      chartData: last7Days // ✅ إرسال بيانات الرسم البياني الحقيقية
    });

  } catch (err) {
    console.error("Super Admin Stats Error:", err.message);
    return res.status(500).json({ error: 'فشل جلب الإحصائيات' });
  }
}
