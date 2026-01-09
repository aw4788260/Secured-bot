import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId } = req.query;
  if (!teacherId) return res.status(400).json({ error: 'Missing Id' });

  try {
    // جلب بيانات المدرس
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, name, bio, specialty')
      .eq('id', teacherId)
      .single();

    if (!teacher) return res.status(404).json({ error: 'Not found' });

    // جلب كورساته
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, price, code, rating, reviews') // تأكد من وجود rating/reviews في الجدول أو احذفها
      .eq('teacher_id', teacherId);

    return res.status(200).json({
      ...teacher,
      courses: courses || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
