// pages/api/dashboard/super/app-versions.js
import { supabase } from '../../../../lib/supabaseClient';

export default async function handler(req, res) {
  // ملاحظة: يفضل إضافة كود التحقق من صلاحيات الأدمن هنا (مثل التحقق من التوكن أو الجلسة)

  // 1. جلب البيانات (GET)
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('platform'); // ترتيب حسب المنصة (android ثم ios)

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // 2. تحديث البيانات (PUT)
  if (req.method === 'PUT') {
    const { id, min_version, latest_version, force_update, message, store_url } = req.body;

    try {
      const { data, error } = await supabase
        .from('app_versions')
        .update({
          min_version,
          latest_version,
          force_update,
          message,
          store_url,
          updated_at: new Date(),
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return res.status(200).json(data[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
