import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return; 

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startDate, endDate } = req.query;

  // تجهيز التواريخ بتنسيق مناسب للدالة (ISO String) مع ضبط التوقيت
  const formattedStartDate = startDate ? `${startDate}T00:00:00` : null;
  const formattedEndDate = endDate ? `${endDate}T23:59:59` : null;

  try {
    // ============================================================
    // 🆕 1. جلب نسبة المنصة من جدول الإعدادات
    // ============================================================
    let PLATFORM_PERCENTAGE = 0.10; // القيمة الافتراضية (10%)

    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_percentage')
      .maybeSingle();

    if (!settingsError && settingsData) {
      const val = parseFloat(settingsData.value);
      if (!isNaN(val)) {
        // تحويل الرقم: إذا كان > 1 (مثل 15) نقسمه على 100، وإلا نستخدمه كما هو
        PLATFORM_PERCENTAGE = val > 1 ? val / 100 : val;
      }
    }

    // ============================================================
    // 🆕 2. حساب الإجمالي الكلي باستخدام RPC (الدالة المعدلة)
    // ============================================================
    const { data: totalRevenueRPC, error: rpcError } = await supabase
      .rpc('get_total_revenue', { 
        start_date: formattedStartDate, 
        end_date: formattedEndDate 
      });

    if (rpcError) throw rpcError;

    const totalRevenue = totalRevenueRPC || 0;

    // ============================================================
    // 3. جلب قائمة المدرسين وحساب أرباح كل مدرس
    // ============================================================
    const { data: teachersList, error: teacherError } = await supabase
      .from('users')
      .select('id, first_name, admin_username')
      .eq('role', 'teacher');

    if (teacherError) throw teacherError;

    // استخدام Promise.all لتنفيذ حسابات المدرسين بشكل متوازي لزيادة السرعة
    const teachersDataPromises = teachersList.map(async (teacher) => {
      // استدعاء دالة RPC لحساب أرباح المدرس في الفترة المحددة
      const { data: teacherSales } = await supabase
        .rpc('get_teacher_revenue', { 
            teacher_id_arg: teacher.id,
            start_date: formattedStartDate, 
            end_date: formattedEndDate
        });

      const sales = teacherSales || 0;
      
      // حساب النسب
      const platformFee = sales * PLATFORM_PERCENTAGE;
      const netProfit = sales - platformFee;

      // حساب عدد العمليات (اختياري، يتم جلبه فقط إذا كان هناك مبيعات لتوفير الموارد)
      let transactionCount = 0;
      if (sales > 0) {
         const { count } = await supabase
           .from('subscription_requests')
           .select('id', { count: 'exact', head: true })
           .eq('teacher_id', teacher.id)
           .eq('status', 'approved')
           // نستخدم فلترة التاريخ هنا أيضاً لضمان تطابق العدد مع المبلغ
           .gte('created_at', formattedStartDate || '1970-01-01')
           .lte('created_at', formattedEndDate || new Date().toISOString());
         transactionCount = count || 0;
      }

      return {
        id: teacher.id,
        name: teacher.first_name || teacher.admin_username || 'مدرس غير معروف',
        sales: sales,
        transaction_count: transactionCount,
        platform_fee: platformFee,
        net_profit: netProfit
      };
    });

    // انتظار اكتمال جميع الحسابات وتصفية النتائج
    const processedTeachersList = await Promise.all(teachersDataPromises);
    
    // ترتيب القائمة حسب الأكثر مبيعاً (تنازلياً)
    const finalTeachersList = processedTeachersList.sort((a, b) => b.sales - a.sales);

    // 4. تجميع الإحصائيات العامة للمنصة
    const platformProfitTotal = totalRevenue * PLATFORM_PERCENTAGE;
    const teachersDueTotal = totalRevenue - platformProfitTotal;

    // إرسال الرد النهائي
    return res.status(200).json({
      percentage_used: (PLATFORM_PERCENTAGE * 100) + '%', // توضيح النسبة المستخدمة
      total_revenue: totalRevenue,
      platform_profit: platformProfitTotal,
      teachers_due: teachersDueTotal,
      teachers_list: finalTeachersList
    });

  } catch (err) {
    console.error('Finance API Error:', err);
    return res.status(500).json({ error: 'فشل حساب التقارير المالية', details: err.message });
  }
}
