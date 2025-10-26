// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  try {
    // هذه الميزة في Supabase رائعة
    // .select() تقوم بجلب الكورسات، وتجلب معها "الفيديوهات" المرتبطة بها
    const { data, error } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        videos (
          id,
          title
        )
      `)
      // ترتيب الكورسات أبجدياً
      .order('title', { ascending: true })
      // ترتيب الفيديوهات داخل كل كورس بالـ ID
      .order('id', { foreignTable: 'videos', ascending: true });

    if (error) throw error;
    
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
