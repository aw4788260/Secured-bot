import { supabase } from '../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../lib/dashboardHelper'; 

export default async function handler(req, res) {
  // 1. التحقق من نوع الطلب
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. التحقق الأمني باستخدام الدالة الصحيحة (requireSuperAdmin)
  // هذه الدالة تتحقق من الكوكيز والصلاحيات وترسل الرد في حالة الخطأ
  const authResult = await requireSuperAdmin(req, res);
  
  // إذا وجد خطأ، نتوقف لأن الرد قد تم إرساله بالفعل
  if (authResult.error) {
      return;
  }

  try {
    // 3. جلب البيانات بشكل متوازي (Parallel) لتحسين الأداء
    const [
      { count: studentsCount },
      { count: teachersCount },
      { count: coursesCount },
      { data: revenueData },
      { data: recentUsers }
    ] = await Promise.all([
      // أ: عدد الطلاب (الذين دورهم student)
      supabase.from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),

      // ب: عدد المدرسين (الذين دورهم teacher)
      supabase.from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher'),

      // ج: عدد الكورسات النشطة
      supabase.from('courses')
        .select('*', { count: 'exact', head: true }),

      // د: إجمالي الأرباح (من الطلبات المقبولة فقط)
      supabase.from('subscription_requests')
        .select('total_price')
        .eq('status', 'approved'),

      // هـ: آخر 5 مستخدمين انضموا للمنصة (للعرض في الجدول)
      supabase.from('users')
        .select('id, first_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    // 4. حساب مجموع الأرباح يدوياً
    const totalRevenue = revenueData?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;

    // 5. إرجاع البيانات بنفس الأسماء التي يتوقعها الـ Frontend
    res.status(200).json({
      totalUsers: studentsCount || 0,
      totalTeachers: teachersCount || 0,
      activeCourses: coursesCount || 0,
      totalRevenue: totalRevenue,
      recentUsers: recentUsers?.map(user => ({
        id: user.id,
        name: user.first_name || 'مستخدم غير معروف',
        role: user.role,
        date: user.created_at
      })) || []
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'حدث خطأ داخلي أثناء جلب الإحصائيات' });
  }
}
