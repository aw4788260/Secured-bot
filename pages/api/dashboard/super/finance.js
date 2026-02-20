import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

// ✅ دالة ذكية لحساب فرق التوقيت لمصر بناءً على التاريخ (تدعم الصيفي والشتوي)
const getEgyptOffset = (dateString) => {
    try {
        const date = new Date(dateString);
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'shortOffset' });
        const parts = fmt.formatToParts(date);
        const offsetString = parts.find(p => p.type === 'timeZoneName').value; // سينتج "GMT+2" أو "GMT+3"
        
        const hours = parseInt(offsetString.replace(/[^\d+-]/g, '')) || 2;
        const sign = hours >= 0 ? '+' : '-';
        const paddedHours = Math.abs(hours).toString().padStart(2, '0');
        
        return `${sign}${paddedHours}:00`; // النتيجة النهائية: "+02:00" أو "+03:00"
    } catch (e) {
        return '+02:00'; // قيمة احتياطية
    }
};

export default async function handler(req, res) {
  // 🆔 إعداد لوجات التتبع (Logs) لمراقبة الطلبات
  const reqId = Math.random().toString(36).substring(7).toUpperCase();
  const logPrefix = `[FinanceAPI - ${reqId}]`;

  const log = (step, msg, data = null) => {
    console.log(`🔹 ${logPrefix} [${step}] ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  };

  const errLog = (step, msg, error) => {
    console.error(`❌ ${logPrefix} [${step}] ${msg}`, error);
  };

  log('START', 'Starting Finance Report Request...', { query: req.query });

  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) {
    return; // الرد يتم إرساله داخل requireSuperAdmin
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startDate, endDate } = req.query;

  // ✅ تطبيق فرق التوقيت الديناميكي
  const startOffset = startDate ? getEgyptOffset(startDate) : '+02:00';
  const endOffset = endDate ? getEgyptOffset(endDate) : '+02:00';

  const formattedStartDate = startDate ? `${startDate}T00:00:00${startOffset}` : null;
  const formattedEndDate = endDate ? `${endDate}T23:59:59${endOffset}` : null;

  try {
    // ============================================================
    // 1. جلب نسبة المنصة من جدول الإعدادات
    // ============================================================
    let PLATFORM_PERCENTAGE = 0.10; // القيمة الافتراضية (10%)

    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_percentage')
      .maybeSingle();

    if (settingsData) {
      const val = parseFloat(settingsData.value);
      if (!isNaN(val)) {
        // تحويل الرقم: إذا كان > 1 (مثل 15) نقسمه على 100، وإلا نستخدمه كما هو
        PLATFORM_PERCENTAGE = val > 1 ? val / 100 : val;
      }
    }

    log('CONFIG', `Platform Percentage: ${PLATFORM_PERCENTAGE * 100}%`);

    // ============================================================
    // 2. حساب الإجمالي الكلي باستخدام RPC (السعرين)
    // ============================================================
    
    // أ) الإجمالي الأصلي/الافتراضي (الدالة القديمة)
    const { data: totalOriginalRPC, error: rpcErrorOriginal } = await supabase
      .rpc('get_total_revenue', { 
        start_date: formattedStartDate, 
        end_date: formattedEndDate 
      });
    if (rpcErrorOriginal) throw rpcErrorOriginal;

    // ب) الإجمالي الفعلي المُحصل (الدالة الجديدة)
    const { data: totalActualRPC, error: rpcErrorActual } = await supabase
      .rpc('get_total_actual_revenue', { 
        start_date: formattedStartDate, 
        end_date: formattedEndDate 
      });
    if (rpcErrorActual) throw rpcErrorActual;

    const totalOriginalRevenue = totalOriginalRPC || 0;
    const totalActualRevenue = totalActualRPC || 0;
    
    log('TOTAL', `Original Revenue: ${totalOriginalRevenue} | Actual Revenue: ${totalActualRevenue}`);

    // ============================================================
    // 3. جلب قائمة المدرسين وحساب أرباح كل مدرس عبر RPC
    // ============================================================
    // ⚠️ هام: نجلب teacher_profile_id لأن الأموال مربوطة به في جدول العمليات
    const { data: teachersList, error: teacherError } = await supabase
      .from('users')
      .select('id, first_name, admin_username, teacher_profile_id')
      .eq('role', 'teacher');

    if (teacherError) throw teacherError;

    // استخدام Promise.all لتنفيذ الحسابات بشكل متوازي
    const teachersDataPromises = teachersList.map(async (teacher) => {
      
      // إذا لم يكن للمستخدم بروفايل مدرس، لا يمكننا حساب أرباحه (تخطي)
      if (!teacher.teacher_profile_id) {
         return {
            id: teacher.id,
            name: teacher.first_name || teacher.admin_username || 'مدرس (بدون بروفايل)',
            original_sales: 0,
            actual_sales: 0,
            transaction_count: 0,
            platform_fee: 0,
            net_profit: 0
         };
      }

      // أ) المبيعات الأصلية للمدرس
      const { data: originalSalesRPC, error: rpcError1 } = await supabase
        .rpc('get_teacher_revenue', { 
            teacher_id_arg: teacher.teacher_profile_id, 
            start_date: formattedStartDate, 
            end_date: formattedEndDate
        });
      
      // ب) المبيعات الفعلية للمدرس
      const { data: actualSalesRPC, error: rpcError2 } = await supabase
        .rpc('get_teacher_actual_revenue', { 
            teacher_id_arg: teacher.teacher_profile_id, 
            start_date: formattedStartDate, 
            end_date: formattedEndDate
        });

      if (rpcError1) errLog('RPC_ERROR_1', `Failed original for teacher ${teacher.first_name}`, rpcError1);
      if (rpcError2) errLog('RPC_ERROR_2', `Failed actual for teacher ${teacher.first_name}`, rpcError2);

      const originalSales = originalSalesRPC || 0;
      const actualSales = actualSalesRPC || 0;
      
      // ✅ حساب النسب والمستحقات يكون بناءً على "المبيعات الفعلية"
      const platformFee = actualSales * PLATFORM_PERCENTAGE;
      const netProfit = actualSales - platformFee;

      // حساب عدد العمليات (فقط إذا كان هناك مبيعات لتوفير الموارد)
      let transactionCount = 0;
      if (actualSales > 0 || originalSales > 0) {
         const { count } = await supabase
           .from('subscription_requests')
           .select('id', { count: 'exact', head: true })
           .eq('teacher_id', teacher.teacher_profile_id) // ✅ استخدام المعرف الصحيح
           .eq('status', 'approved')
           .gte('created_at', formattedStartDate || '1970-01-01T00:00:00Z') // حماية التوقيت هنا أيضاً
           .lte('created_at', formattedEndDate || new Date().toISOString());
         transactionCount = count || 0;
         
         log('RESULT', `Teacher: ${teacher.first_name} | Original: ${originalSales} | Actual: ${actualSales}`);
      }

      return {
        id: teacher.id, // نُعيد ID المستخدم للفرونت إند لغرض العرض والروابط
        name: teacher.first_name || teacher.admin_username || 'مدرس غير معروف',
        original_sales: originalSales,
        actual_sales: actualSales,
        transaction_count: transactionCount,
        platform_fee: platformFee,
        net_profit: netProfit
      };
    });

    // انتظار اكتمال جميع الحسابات
    const processedTeachersList = await Promise.all(teachersDataPromises);
    
    // ترتيب القائمة حسب الأكثر مبيعاً فعلياً (تنازلياً)
    const finalTeachersList = processedTeachersList.sort((a, b) => b.actual_sales - a.actual_sales);

    // 4. تجميع الإحصائيات العامة للمنصة (بناءً على المبالغ الفعلية)
    const platformProfitTotal = totalActualRevenue * PLATFORM_PERCENTAGE;
    const teachersDueTotal = totalActualRevenue - platformProfitTotal;

    // إرسال الرد النهائي المتوافق مع التعديلات
    return res.status(200).json({
      percentage_used: (PLATFORM_PERCENTAGE * 100) + '%',
      total_original_revenue: totalOriginalRevenue,
      total_actual_revenue: totalActualRevenue,
      platform_profit: platformProfitTotal,
      teachers_due: teachersDueTotal,
      teachers_list: finalTeachersList
    });

  } catch (err) {
    errLog('CRITICAL', 'Finance API Error:', err);
    return res.status(500).json({ error: 'فشل حساب التقارير المالية', details: err.message });
  }
}
