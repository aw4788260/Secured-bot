import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { teacherId } = req.query;
  if (!teacherId) return res.status(400).json({ error: 'Missing Id' });

  try {
    // جلب بيانات المدرس (بما فيها profile_image)
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, name, bio, specialty, whatsapp_number, profile_image')
      .eq('id', teacherId)
      .single();

    if (!teacher) return res.status(404).json({ error: 'Not found' });

    // ✅ معالجة رابط الصورة ليصبح رابطاً كاملاً للـ API
    if (teacher.profile_image && !teacher.profile_image.startsWith('http')) {
        // نقوم بدمج الدومين ومسار الـ API مع اسم الصورة
        teacher.profile_image = `https://courses.aw478260.dpdns.org/api/public/get-avatar?file=${teacher.profile_image}`;
    }

    // جلب الكورسات الخاصة بالمدرس
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, price, code') 
      .eq('teacher_id', teacherId);

    return res.status(200).json({
      ...teacher,
      courses: courses || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
