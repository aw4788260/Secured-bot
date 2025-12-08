import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  // 1. الاعتماد الكلي على الهيدر المرسل من المتصفح
  const userId = req.headers['x-user-id'];

  // إذا لم نجد مستخدم، نعيد مصفوفات فارغة
  if (!userId) return res.status(200).json({ courses: [], subjects: [] });

  try {
      // 2. جلب الكورسات المشترك بها
      const { data: courses } = await supabase
          .from('user_course_access')
          .select('course_id')
          .eq('user_id', userId);

      // 3. جلب المواد المشترك بها
      const { data: subjects } = await supabase
          .from('user_subject_access')
          .select('subject_id')
          .eq('user_id', userId);

      return res.status(200).json({
          courses: courses ? courses.map(c => c.course_id) : [],
          subjects: subjects ? subjects.map(s => s.subject_id) : []
      });
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
