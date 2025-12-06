import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  try {
    // جلب الكورسات ومعها المواد المرتبطة بها
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id, 
        title, 
        price, 
        sort_order,
        subjects ( id, title, price, sort_order )
      `)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // ترتيب المواد داخل كل كورس
    const formattedData = courses.map(course => ({
      ...course,
      subjects: course.subjects ? course.subjects.sort((a, b) => a.sort_order - b.sort_order) : []
    }));

    return res.status(200).json(formattedData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
