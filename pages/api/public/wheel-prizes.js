import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { data: prizes, error } = await supabase
      .from('wheel_prizes')
      .select('id, title, color')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ success: true, prizes: prizes || [] });
  } catch (err) {
    return res.status(500).json({ error: 'فشل جلب بيانات العجلة' });
  }
}
