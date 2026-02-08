import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

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
    // 1. جلب بيانات المدرس + teacher_profile_id (التصحيح هنا)
    // ============================================================
    const { data: teacher, error: tError } = await supabase
        .from('users')
        .select('first_name, admin_username, teacher_profile_id') // 👈 جلبنا معرف البروفايل
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
            summary: { total_approved_amount: 0, total_approved_count: 0, total_rejected_count: 0 },
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
    // 3. إعداد استعلام العمليات (باستخدام teacher_profile_id)
    // ============================================================
    let query = supabase
      .from('subscription_requests')
      .select('*')
      .eq('teacher_id', teacher.teacher_profile_id) // ✅ استخدام المعرف الصحيح
      .in('status', ['approved', 'rejected'])
      .order('created_at', { ascending: false });

    // فلترة التاريخ
    if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data: requests, error: rError } = await query;

    if (rError) throw rError;

    log('DATA_FETCHED', `Found ${requests.length} requests for ProfileID ${teacher.teacher_profile_id}`);

    // حساب التجميعات
    const summary = {
        total_approved_amount: 0,
        total_approved_count: 0,
        total_rejected_count: 0
    };

    requests.forEach(req => {
        if (req.status === 'approved') {
            summary.total_approved_amount += (req.total_price || 0);
            summary.total_approved_count += 1;
        } else if (req.status === 'rejected') {
            summary.total_rejected_count += 1;
        }
    });

    log('SUCCESS', `Report Ready. Total Amount: ${summary.total_approved_amount}`);

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
