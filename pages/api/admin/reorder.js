import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { type, items } = req.body; 
  // type: 'courses', 'subjects', 'chapters', 'videos', 'pdfs'
  // items: [{ id: 1, sort_order: 0 }, { id: 5, sort_order: 1 }, ...]

  if (!type || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid Data' });
  }

  try {
      // تحديث الترتيب لكل عنصر
      for (const item of items) {
          await supabase
              .from(type)
              .update({ sort_order: item.sort_order })
              .eq('id', item.id);
      }
      
      return res.status(200).json({ success: true });
  } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
  }
};
