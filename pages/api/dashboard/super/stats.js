import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  try {
    // ✅ تحديث إحصائيات اليوم في قاعدة البيانات قبل جلبها (لضمان دقة الأرقام الحالية)
    await supabase.rpc('update_daily_user_stats');

    // تحديد نطاق التاريخ (آخر 7 أيام)
    // نقوم بتصفير الوقت (الساعة 00:00) لضمان شمولية اليوم بالكامل
    const dateLimitObj = new Date();
    dateLimitObj.setDate(dateLimitObj.getDate() - 7);
    dateLimitObj.setHours(0, 0, 0, 0); 
    const dateLimit = dateLimitObj.toISOString();

    // استخراج التاريخ المحلي لاستخدامه كفلتر لجدول الإحصائيات اليومية
    const limitYear = dateLimitObj.getFullYear();
    const limitMonth = String(dateLimitObj.getMonth() + 1).padStart(2, '0');
    const limitDay = String(dateLimitObj.getDate()).padStart(2, '0');
    const localLimitDateStr = `${limitYear}-${limitMonth}-${limitDay}`;

    // استخدام Promise.all لتنفيذ جميع الاستعلامات في نفس الوقت
    const [
        studentsResult, 
        teachersResult, 
        coursesResult, 
        revenueRpcResult,
        recentUsersResult,
        chartDataResult, // استعلام الرسم البياني للمبيعات
        dailyStatsResult // ✅ استعلام إحصائيات النشاط اليومي
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

      // 6. بيانات الرسم البياني (أرباح الفترة المحددة)
      supabase
        .from('subscription_requests')
        .select('created_at, total_price')
        .eq('status', 'approved')
        .gte('created_at', dateLimit),

      // 7. ✅ جلب إحصائيات النشاط اليومي بناءً على التاريخ المحلي لتجنب فقدان أي يوم
      supabase
        .from('daily_user_stats')
        .select('record_date, active_users_today')
        .gte('record_date', localLimitDateStr)
        .order('record_date', { ascending: false })
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

    // --- معالجة بيانات الرسوم البيانية ---
    const chartDataFinal = [];
    const activeUsersChartFinal = []; // ✅ مصفوفة بيانات رسم النشاط
    const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    const rawChartData = chartDataResult.data || [];
    const rawDailyStats = dailyStatsResult.data || [];

    // ✅ الترتيب: من 6 أيام للوراء تنازلياً وصولاً لليوم (لضبط اتجاه الرسم البياني من اليسار لليمين)
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i); 
        const dayName = daysMap[d.getDay()]; 
        
        // ========================================================
        // 💰 الجزء الخاص بالأرباح (تم تركه كما هو بتوقيت UTC كما طلبت)
        // ========================================================
        const utcDateStr = d.toISOString().split('T')[0];
        
        const dayTotal = rawChartData
            .filter(item => {
                const itemDateStr = new Date(item.created_at).toISOString().split('T')[0];
                return itemDateStr === utcDateStr;
            })
            .reduce((sum, item) => sum + (item.total_price || 0), 0);
            
        chartDataFinal.push({ 
            name: i === 0 ? 'اليوم' : dayName,
            date: utcDateStr, 
            sales: dayTotal 
        });

        // ========================================================
        // 👥 الجزء الخاص بعدد المستخدمين النشطين (تم تعديله للتوقيت المحلي)
        // ========================================================
        const localYear = d.getFullYear();
        const localMonth = String(d.getMonth() + 1).padStart(2, '0');
        const localDay = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${localYear}-${localMonth}-${localDay}`;

        const foundStat = rawDailyStats.find(s => s.record_date === localDateStr);
        activeUsersChartFinal.push({
            name: i === 0 ? 'اليوم' : dayName,
            date: localDateStr,
            users: foundStat ? foundStat.active_users_today : 0
        });
    }

    // ✅ استخراج رقم النشطين اليوم (آخر عنصر في المصفوفة لأننا رتبناها تصاعدياً زمنياً)
    const activeUsersToday = activeUsersChartFinal[6]?.users || 0;

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
      chartData: chartDataFinal,
      activeUsersChartData: activeUsersChartFinal, // ✅ بيانات رسم النشاط
      activeUsersToday: activeUsersToday // ✅ رقم النشطين اليوم للبطاقة
    });

  } catch (err) {
    console.error("Super Admin Stats Error:", err.message);
    return res.status(500).json({ error: 'فشل جلب الإحصائيات' });
  }
}
