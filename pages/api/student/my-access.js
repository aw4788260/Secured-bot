import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  // 1. الأولوية: قراءة الـ Header المرسل من المتصفح (localStorage)
  let userId = req.headers['x-user-id'];

  // 2. احتياطي: إذا لم يُرسل الهيدر، نحاول قراءة الكوكي (للأمان)
  if (!userId) {
      const cookies = parse(req.headers.cookie || '');
      const sessionToken = cookies.student_session;
      
      if (sessionToken) {
          const { data: user } = await supabase.from('users').select('id').eq('session_token', sessionToken).single();
          if (user) userId = user.id;
      }
  }

  // إذا لم نجد مستخدم، نعيد مصفوفات فارغة
  if (!userId) return res.status(200).json({ courses: [], subjects: [] });

  try {
      // 3. جلب الكورسات المشترك بها
      const { data: courses } = await supabase
          .from('user_course_access')
          .select('course_id')
          .eq('user_id', userId);

      // 4. جلب المواد المشترك بها
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
