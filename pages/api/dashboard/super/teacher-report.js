import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

// ✅ دالة ذكية لحساب فرق التوقيت لمصر بناءً على التاريخ (تدعم الصيفي والشتوي)
const getEgyptOffset = (dateString) => {
    try {
        const date = new Date(dateString);
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'shortOffset' });
        const parts = fmt.formatToParts(date);
        const offsetString = parts.find(p => p.type === 'timeZoneName').value; 
        
        const hours = parseInt(offsetString.replace(/[^\d+-]/g, '')) || 2;
        const sign = hours >= 0 ? '+' : '-';
        const paddedHours = Math.abs(hours).toString().padStart(2, '0');
        return `${sign}${paddedHours}:00`; 
    } catch (e) {
        return '+02:00'; 
    }
};

// ✅ الدالة الجديدة: تحويل تاريخ مصر إلى UTC (جرينتش) صريح قبل إرساله للداتابيز
const getUtcBoundary = (dateString, isEnd = false) => {
    if (!dateString) return null;
    const offset = getEgyptOffset(dateString);
    const time = isEnd ? '23:59:59' : '00:00:00';
    // بناء التاريخ بتوقيت مصر ثم تحويله لـ ISO (الذي يعطينا توقيت جرينتش بحرف Z)
    return new Date(`${dateString}T${time}${offset}`).toISOString();
};

export default async function handler(req, res) {
  // 🆔 إعداد لوجات التتبع (Logs)
  const reqId = Math.random().toString(36).substring(7).toUpperCase();
  const logPrefix = `[TeacherReport - ${reqId}]`;

  const log = (step, msg, data = null) => {
    console.log(`🔹 ${logPrefix} [${step}] ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  };

  const errLog = (step, msg, error) => {
    console.error(`❌ ${logPrefix} [${step}] ${msg}`, error);
  };

  log('START', 'Requesting Teacher Report...', { query: req.query });

  // التحقق من الصلاحية
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return; 

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teacherId, startDate, endDate } = req.query;

  if (!teacherId) {
    errLog('VALIDATION', 'Teacher ID is missing');
    return res.status(400).json({ error: 'Teacher ID is required' });
  }

  try {
    // ============================================================
    // 1. جلب بيانات المدرس
    // ============================================================
    const { data: teacher, error: tError } = await supabase
        .from('users')
        .select('first_name, admin_username, teacher_profile_id')
        .eq('id', teacherId)
        .single();
    
    if (tError || !teacher) {
        errLog('FETCH_USER', 'User not found', tError);
        return res.status(404).json({ error: 'المدرس غير موجود' });
    }

    log('USER_FOUND', `User: ${teacher.first_name} | ProfileID: ${teacher.teacher_profile_id}`);

    if (!teacher.teacher_profile_id) {
        log('WARN', 'User is not linked to a teacher profile');
        return res.status(200).json({
            teacherName: teacher.first_name || teacher.admin_username,
            requests: [],
            summary: { total_original_amount: 0, total_actual_amount: 0, total_approved_count: 0, total_rejected_count: 0 },
            platformPercentage: 0
        });
    }

    // ============================================================
    // 2. جلب نسبة المنصة من الإعدادات
    // ============================================================
    let platformPercentage = 0.10; 
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_percentage')
      .maybeSingle();

    if (settingsData && settingsData.value) {
      const val = parseFloat(settingsData.value);
      if (!isNaN(val)) {
        platformPercentage = val > 1 ? val / 100 : val;
      }
    }

    // ============================================================
    // 3. تنسيق التواريخ للدالة والاستعلام مع فرق التوقيت الديناميكي
    // ============================================================
    // الاعتماد على التوقيت العالمي الصريح
    const formattedStartDate = getUtcBoundary(startDate, false);
    const formattedEndDate = getUtcBoundary(endDate, true);

    // ============================================================
    // ✅ 4. جلب الأرباح الفعلية مباشرة من دالة قاعدة البيانات (RPC)
    // ============================================================
    log('FETCH_RPC', 'Calling get_teacher_actual_revenue RPC...');
    
    const { data: actualRevenueRPC, error: rpcError } = await supabase.rpc('get_teacher_actual_revenue', {
        teacher_id_arg: teacher.teacher_profile_id,
        start_date: formattedStartDate,
        end_date: formattedEndDate
    });

    if (rpcError) {
        errLog('RPC_ERROR', 'Failed to calculate actual revenue via DB function', rpcError);
    }
    
    const totalActualAmount = actualRevenueRPC || 0;
    log('RPC_RESULT', `Actual Revenue from RPC: ${totalActualAmount}`);

    // ============================================================
    // 5. إعداد استعلام العمليات (للعرض في الجدول)
    // ============================================================
    let query = supabase
      .from('subscription_requests')
      .select('*')
      .eq('teacher_id', teacher.teacher_profile_id)
      .in('status', ['approved', 'rejected'])
      .order('created_at', { ascending: false });

    // تطبيق فلترة التاريخ للجدول أيضاً
    if (formattedStartDate) query = query.gte('created_at', formattedStartDate);
    if (formattedEndDate) query = query.lte('created_at', formattedEndDate);

    const { data: requests, error: rError } = await query;

    if (rError) throw rError;

    // ============================================================
    // 6. حساب باقي التجميعات البسيطة
    // ============================================================
    const summary = {
        total_original_amount: 0, 
        total_actual_amount: totalActualAmount, // 👈 تم الاعتماد على الدالة (RPC) هنا!
        total_approved_count: 0,
        total_rejected_count: 0
    };

    // حلقة التكرار الآن تُستخدم فقط لحساب أعداد الطلبات والسعر الافتراضي الأصلي
    requests.forEach(req => {
        if (req.status === 'approved') {
            summary.total_original_amount += (req.total_price || 0);
            summary.total_approved_count += 1;
        } else if (req.status === 'rejected') {
            summary.total_rejected_count += 1;
        }
    });

    log('SUCCESS', `Report Ready. Actual Amount: ${summary.total_actual_amount}`);

    return res.status(200).json({
        teacherName: teacher.first_name || teacher.admin_username,
        requests,
        summary,
        platformPercentage 
    });

  } catch (err) {
    errLog('CRITICAL_ERROR', 'Report API Error:', err);
    return res.status(500).json({ error: 'فشل جلب تقرير المدرس', details: err.message });
  }
}
