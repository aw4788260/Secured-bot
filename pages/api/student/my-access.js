// pages/api/student/my-access.js
import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.student_session; // توكن الطالب

  if (!sessionToken) return res.status(200).json({ courses: [], subjects: [] });

  const { data: user } = await supabase.from('users').select('id').eq('session_token', sessionToken).single();
  if (!user) return res.status(200).json({ courses: [], subjects: [] });

  // جلب الكورسات
  const { data: courses } = await supabase.from('user_course_access').select('course_id').eq('user_id', user.id);
  // جلب المواد
  const { data: subjects } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', user.id);

  return res.status(200).json({
      courses: courses.map(c => c.course_id),
      subjects: subjects.map(s => s.subject_id)
  });
};
