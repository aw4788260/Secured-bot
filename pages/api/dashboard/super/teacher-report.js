import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // التحقق من الصلاحية
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return; 

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teacherId, startDate, endDate } = req.query;

  if (!teacherId) {
    return res.status(400).json({ error: 'Teacher ID is required' });
  }

  try {
    // 1. جلب بيانات المدرس
    const { data: teacher, error: tError } = await supabase
        .from('users')
        .select('first_name, admin_username')
        .eq('id', teacherId)
        .single();
    
    if (tError) throw tError;

    // 2. جلب نسبة المنصة من الإعدادات (تعديل جديد)
    let platformPercentage = 0.10; // القيمة الافتراضية
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

    // 3. إعداد استعلام العمليات
    let query = supabase
      .from('subscription_requests')
      .select('*')
      .eq('teacher_id', teacherId)
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

    return res.status(200).json({
        teacherName: teacher.first_name || teacher.admin_username,
        requests,
        summary,
        platformPercentage // إرسال النسبة للواجهة الأمامية
    });

  } catch (err) {
    console.error('Report API Error:', err);
    return res.status(500).json({ error: 'فشل جلب تقرير المدرس' });
  }
}
