import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية (سوبر أدمن فقط)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // 2. معالجة طلب حفظ الإعدادات (POST)
  if (req.method === 'POST') {
      const { vodafone, instapayNumber, instapayLink } = req.body;
      
      const updates = [
          { key: 'vodafone_cash_number', value: vodafone },
          { key: 'instapay_number', value: instapayNumber },
          { key: 'instapay_link', value: instapayLink }
      ];

      // استخدام onConflict للتأكد من التحديث بناءً على المفتاح 'key'
      const { error } = await supabase
        .from('app_settings')
        .upsert(updates, { onConflict: 'key' });
      
      if (error) {
        console.error('Error saving settings:', error);
        return res.status(500).json({ error: 'فشل حفظ الإعدادات' });
      }

      return res.status(200).json({ success: true });
  }
  
  // 3. معالجة طلب جلب الإعدادات (GET)
  if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) {
        console.error('Error fetching settings:', error);
        return res.status(500).json({ error: 'فشل جلب الإعدادات' });
      }

      // تحويل مصفوفة البيانات إلى كائن (Object) ليسهل التعامل معه في الواجهة
      const settings = {};
      data?.forEach(item => {
          settings[item.key] = item.value;
      });

      return res.status(200).json(settings);
  }

  // في حال كان الطلب غير مدعوم
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
