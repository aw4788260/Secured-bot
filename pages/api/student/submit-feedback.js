import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 🛡️ التحقق من الأمان عبر authHelper (بدون تمرير resourceId ليكون فحصاً عاماً للتوكن والجهاز)
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) return res.status(401).json({ message: 'Unauthorized access' });

  const { chapter_id, content } = req.body;

  if (!chapter_id || !content) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const { error } = await supabase
      .from('chapter_feedback')
      .insert([{ chapter_id, content }]);

    if (error) throw error;
    return res.status(200).json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
