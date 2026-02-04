import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return;

  if (req.method === 'GET') {
    try {
      // جلب الكورسات
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .order('id');

      if (coursesError) throw coursesError;

      // جلب المواد
      const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, title, course_id')
        .order('id');

      if (subjectsError) throw subjectsError;

      // دمج المواد داخل الكورسات (Nesting)
      // هذا الهيكل هو ما يتوقعه الفرونت إند بالضبط لعرض القوائم المنسدلة
      const structuredCourses = courses.map(course => ({
        ...course,
        subjects: subjects.filter(subject => subject.course_id === course.id)
      }));

      return res.status(200).json({
        courses: structuredCourses
      });

    } catch (error) {
      console.error('Content API Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
