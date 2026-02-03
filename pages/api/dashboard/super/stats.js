import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  try {
    // تحديد نطاق التاريخ (آخر 7 أيام)
    // نقوم بتصفير الوقت (الساعة 00:00) لضمان شمولية اليوم بالكامل
    const dateLimitObj = new Date();
    dateLimitObj.setDate(dateLimitObj.getDate() - 7);
    dateLimitObj.setHours(0, 0, 0, 0); 
    const dateLimit = dateLimitObj.toISOString();

    // استخدام Promise.all لتنفيذ جميع الاستعلامات في نفس الوقت
    const [
        studentsResult, 
        teachersResult, 
        coursesResult, 
        revenueRpcResult,
        recentUsersResult,
        chartDataResult // ✅ استعلام الرسم البياني
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

      // 6. ✅ بيانات الرسم البياني (أرباح الفترة المحددة)
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
      // حساب احتياطي في حال فشل الـ RPC
      const { data: manualData } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('status', 'approved');
      totalRevenue = manualData?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;
    }

    // --- معالجة بيانات الرسم البياني (تجميع الأرباح يومياً) ---
    // الترتيب: من اليوم الحالي (0) والرجوع للوراء 6 أيام
    const chartDataFinal = [];
    const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const rawChartData = chartDataResult.data || [];

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i); // i=0 هو اليوم، i=1 هو أمس، وهكذا...
        
        // تنسيق التاريخ للمقارنة (ISO Date Part Only: YYYY-MM-DD)
        const dateStr = d.toISOString().split('T')[0];
        const dayName = daysMap[d.getDay()]; 
        
        // تجميع أرباح هذا اليوم
        const dayTotal = rawChartData
            .filter(item => {
                // نأخذ الجزء الخاص بالتاريخ فقط من التوقيت لضمان المطابقة
                const itemDateStr = new Date(item.created_at).toISOString().split('T')[0];
                return itemDateStr === dateStr;
            })
            .reduce((sum, item) => sum + (item.total_price || 0), 0);
            
        chartDataFinal.push({ 
            name: i === 0 ? 'اليوم' : dayName, // تسمية اليوم الحالي بـ "اليوم"
            date: dateStr, 
            sales: dayTotal 
        });
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
      chartData: chartDataFinal // البيانات مرتبة: [اليوم، أمس، ...، قبل 6 أيام]
    });

  } catch (err) {
    console.error("Super Admin Stats Error:", err.message);
    return res.status(500).json({ error: 'فشل جلب الإحصائيات' });
  }
}
