import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  try {
    // استخدام Promise.all لتنفيذ جميع الاستعلامات في نفس الوقت (أداء أسرع)
    const [
        studentsResult, 
        teachersResult, 
        coursesResult, 
        revenueRpcResult,
        recentUsersResult
    ] = await Promise.all([
      // 1. إجمالي الطلاب (role = student)
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),

      // 2. إجمالي المدرسين (role = teacher)
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher'),

      // 3. الكورسات النشطة
      supabase
        .from('courses')
        .select('*', { count: 'exact', head: true }),
        // .eq('is_published', true), // قم بتفعيله إذا أردت حساب الكورسات المنشورة فقط

      // 4. إجمالي المبيعات (RPC Call)
      supabase.rpc('get_total_revenue'),

      // 5. أحدث المسجلين (للعرض في الجدول)
      supabase
        .from('users')
        .select('id, first_name, username, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    // --- معالجة الأرباح (نظام الأمان الهجين) ---
    let totalRevenue = 0;

    if (!revenueRpcResult.error) {
      // نجح الاستدعاء السريع (Function)
      totalRevenue = revenueRpcResult.data || 0;
    } else {
      // فشل الاستدعاء السريع، نستخدم الحساب اليدوي كاحتياطي
      console.warn("⚠️ RPC Failed in super-stats, falling back to manual calc:", revenueRpcResult.error.message);
      
      const { data: manualData } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('status', 'approved'); // نحسب فقط الطلبات المقبولة
      
      totalRevenue = manualData?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;
    }

    // --- تنسيق بيانات المستخدمين الجدد ---
    // نقوم بتعيين الحقول لتناسب ما يتوقعه الجدول في الواجهة الأمامية (name, role, date)
    const formattedRecentUsers = recentUsersResult.data 
        ? recentUsersResult.data.map(u => ({
            id: u.id,
            name: u.first_name || u.username || 'مستخدم جديد',
            role: u.role,
            date: u.created_at
          })) 
        : [];

    // --- إرسال الاستجابة بنفس مسميات الـ Frontend ---
    return res.status(200).json({
      success: true,
      totalUsers: studentsResult.count || 0,
      totalTeachers: teachersResult.count || 0,
      activeCourses: coursesResult.count || 0,
      totalRevenue: totalRevenue,
      recentUsers: formattedRecentUsers
    });

  } catch (err) {
    console.error("Super Admin Stats Error:", err.message);
    return res.status(500).json({ error: 'فشل جلب الإحصائيات' });
  }
}
