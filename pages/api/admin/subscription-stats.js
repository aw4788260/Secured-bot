import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  // 1. التحقق الأمني (نفس المستخدم في باقي ملفات الأدمن)
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  try {
    // 2. جلب إحصائيات الكورسات الكاملة
    // user_course_access يحتوي على الاشتراكات الكاملة فقط
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        title,
        user_course_access (count)
      `);

    if (coursesError) throw coursesError;

    // 3. جلب إحصائيات المواد المنفصلة
    // user_subject_access يحتوي على من اشترى المادة بشكل منفصل فقط (بدون الكورس الكامل)
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select(`
        title,
        user_subject_access (count)
      `);

    if (subjectsError) throw subjectsError;

    // 4. تنسيق البيانات للإرسال
    const formattedCourses = courses.map(c => ({
      title: c.title,
      count: c.user_course_access[0]?.count || 0
    })).sort((a, b) => b.count - a.count); // ترتيب حسب الأكثر اشتراكاً

    const formattedSubjects = subjects.map(s => ({
      title: s.title,
      count: s.user_subject_access[0]?.count || 0
    })).filter(s => s.count > 0) // نعرض فقط المواد التي بها مشتركين
    .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      courses: formattedCourses,
      subjects: formattedSubjects
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
