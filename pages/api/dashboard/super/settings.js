import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return; 

  // ✅ التعديل هنا: تمت إضافة 'player_settings' إلى القائمة
  const TARGET_KEYS = ['platform_percentage', 'support_telegram', 'support_whatsapp', 'free_mode', 'player_settings'];

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
      const settings = {};
      
      // تعيين قيم افتراضية فارغة
      TARGET_KEYS.forEach(key => settings[key] = '');

      // ملء القيم الموجودة في قاعدة البيانات
      if (data) {
        data.forEach(item => {
          // ✅ فك تشفير JSON إذا كان المفتاح هو player_settings
          if (item.key === 'player_settings' && item.value) {
            try {
              settings[item.key] = JSON.parse(item.value);
            } catch (e) {
              settings[item.key] = item.value; // في حالة حدوث خطأ في فك التشفير
            }
          } else {
            settings[item.key] = item.value;
          }
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
      const rowsToUpsert = TARGET_KEYS.map(key => {
        // نأخذ القيمة، وإذا كانت غير موجودة نضع نصاً فارغاً
        const val = updates[key] !== undefined && updates[key] !== null ? updates[key] : '';
        
        // ✅ تحويل الكائن إلى نص JSON إذا كان نوعه Object (خاص بـ player_settings)
        // الدالة String() ستحول باقي الأنواع العادية مثل true/false إلى "true"/"false"
        const stringValue = typeof val === 'object' ? JSON.stringify(val) : String(val);
        
        return {
          key: key,
          value: stringValue 
        };
      });

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
