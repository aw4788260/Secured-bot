import { supabase } from '../../../lib/supabaseClient';
import { BASE_URL } from '../../../lib/config'; // ✅ 1. استيراد ملف الإعدادات الموحد

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

    // ✅ 2. معالجة رابط الصورة باستخدام BASE_URL بدلاً من الرابط الثابت
    if (teacher.profile_image && !teacher.profile_image.startsWith('http')) {
        teacher.profile_image = `${BASE_URL}/api/public/get-avatar?file=${teacher.profile_image}`;
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
