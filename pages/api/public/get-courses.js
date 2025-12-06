import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  // هذا الـ API عام ولا يطلب أي تحقق من الهوية
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, price, sort_order')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return res.status(200).json(courses);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
