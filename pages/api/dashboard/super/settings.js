import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return; 

  // المفاتيح التي نتعامل معها
  const TARGET_KEYS = ['platform_percentage', 'support_telegram', 'support_whatsapp'];

  // --------------------------------------------------------
  // GET: جلب الإعدادات
  // --------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', TARGET_KEYS);

      if (error) throw error;

      // تحويل المصفوفة إلى كائن لسهولة الاستخدام في الواجهة
      // مثال: { platform_percentage: "10", support_telegram: "..." }
      const settings = {};
      
      // تعيين قيم افتراضية فارغة
      TARGET_KEYS.forEach(key => settings[key] = '');

      // ملء القيم الموجودة في قاعدة البيانات
      if (data) {
        data.forEach(item => {
          settings[item.key] = item.value;
        });
      }

      return res.status(200).json(settings);

    } catch (err) {
      console.error("Fetch Settings Error:", err);
      return res.status(500).json({ error: 'فشل جلب الإعدادات' });
    }
  }

  // --------------------------------------------------------
  // POST: حفظ الإعدادات
  // --------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const updates = req.body; // نتوقع كائن يحتوي على المفاتيح والقيم

      // تجهيز البيانات للإدخال (Upsert)
      const rowsToUpsert = TARGET_KEYS.map(key => ({
        key: key,
        value: String(updates[key] || '') // تحويل القيمة لنص وتجنب null
      }));

      const { error } = await supabase
        .from('app_settings')
        .upsert(rowsToUpsert, { onConflict: 'key' });

      if (error) throw error;

      return res.status(200).json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });

    } catch (err) {
      console.error("Save Settings Error:", err);
      return res.status(500).json({ error: 'فشل حفظ الإعدادات' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
