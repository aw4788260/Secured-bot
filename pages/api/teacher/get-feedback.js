import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  // 🛡️ التحقق من الأمان عبر authHelper
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) return res.status(401).json({ message: 'Unauthorized access' });

  // استلام chapter_id ورقم الصفحة page (افتراضياً 1) والحد limit (افتراضياً 10)
  const { chapter_id, page = 1, limit = 10 } = req.query;

  if (!chapter_id) return res.status(400).json({ message: 'Chapter ID is required' });

  // حساب النطاق (Range) لجلب البيانات
  const from = (page - 1) * limit;
  const to = (page * limit) - 1;

  try {
    const { data, error } = await supabase
      .from('chapter_feedback')
      .select('*')
      .eq('chapter_id', chapter_id)
      .order('created_at', { ascending: false })
      .range(from, to); // 👈 تحديد الـ Pagination هنا

    if (error) throw error;

    // معرفة إذا كان هناك بيانات أخرى لطلبها لاحقاً
    const hasMore = data.length === parseInt(limit);

    return res.status(200).json({ success: true, data, hasMore });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
