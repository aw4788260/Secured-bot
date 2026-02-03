import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startDate, endDate } = req.query;

  // نسبة المنصة (يمكن جعلها ديناميكية لاحقاً وجلبها من جدول الإعدادات)
  const PLATFORM_PERCENTAGE = 0.10; // 10%

  try {
    // 2. إعداد تواريخ البحث
    let query = supabase
      .from('subscription_requests')
      .select(`
        id,
        total_price,
        created_at,
        course_id,
        courses (
          id,
          title,
          teacher_id
        )
      `)
      .eq('status', 'approved');

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

    const { data: transactions, error: txError } = await query;

    if (txError) throw txError;

    // 3. جلب أسماء المدرسين
    const { data: teachersList, error: teacherError } = await supabase
      .from('users')
      .select('id, first_name, admin_username')
      .eq('role', 'teacher');

    if (teacherError) throw teacherError;

    // تحويل قائمة المدرسين لسهولة الوصول (Map)
    const teachersMap = {};
    teachersList.forEach(t => {
      teachersMap[t.id] = { 
        name: t.first_name || t.admin_username, 
        sales: 0, 
        transaction_count: 0 
      };
    });

    // 4. معالجة العمليات الحسابية
    let totalRevenue = 0;

    transactions.forEach(tx => {
      const price = tx.total_price || 0;
      totalRevenue += price;

      // تحديد المدرس صاحب الكورس
      const teacherId = tx.courses?.teacher_id;
      
      if (teacherId && teachersMap[teacherId]) {
        teachersMap[teacherId].sales += price;
        teachersMap[teacherId].transaction_count += 1;
      }
    });

    // 5. تجهيز القائمة النهائية للمدرسين مع حساب النسب
    const finalTeachersList = Object.keys(teachersMap).map(tId => {
      const teacher = teachersMap[tId];
      const platformFee = teacher.sales * PLATFORM_PERCENTAGE;
      const netProfit = teacher.sales - platformFee;

      return {
        id: tId,
        name: teacher.name,
        sales: teacher.sales,
        transaction_count: teacher.transaction_count,
        platform_fee: platformFee, // حصة المنصة
        net_profit: netProfit      // صافي ربح المدرس
      };
    });

    // ترتيب القائمة حسب الأكثر مبيعاً
    finalTeachersList.sort((a, b) => b.sales - a.sales);

    // 6. تجميع الإحصائيات العامة
    const platformProfitTotal = totalRevenue * PLATFORM_PERCENTAGE;
    const teachersDueTotal = totalRevenue - platformProfitTotal;

    return res.status(200).json({
      total_revenue: totalRevenue,
      platform_profit: platformProfitTotal,
      teachers_due: teachersDueTotal,
      teachers_list: finalTeachersList
    });

  } catch (err) {
    console.error('Finance API Error:', err);
    return res.status(500).json({ error: 'فشل حساب التقارير المالية' });
  }
}

