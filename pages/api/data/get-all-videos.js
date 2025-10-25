// pages/api/data/get-all-videos.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, course_id')
      .order('id', { ascending: true }); 
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
