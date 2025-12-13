import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  try {
    // 1. جلب الكورسات مع عدد المشتركين (الاشتراك الكامل)
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, user_course_access(count)');

    // 2. جلب المواد مع عدد المشتركين (الاشتراك المنفصل) وربطها بالكورس
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, title, course_id, user_subject_access(count)');

    // 3. هيكلة البيانات (تجميع المواد تحت الكورس الخاص بها)
    const structuredData = courses.map(course => {
        // عدد طلاب الكورس الكامل
        const fullCount = course.user_course_access[0]?.count || 0;

        // المواد التابعة لهذا الكورس (فقط التي بها مشتركين منفصلين)
        const courseSubjects = subjects
            .filter(sub => sub.course_id === course.id)
            .map(sub => ({
                title: sub.title,
                count: sub.user_subject_access[0]?.count || 0
            }))
            .filter(sub => sub.count > 0) // إخفاء المواد التي ليس بها اشتراكات منفصلة
            .sort((a, b) => b.count - a.count);

        return {
            title: course.title,
            fullCount: fullCount,
            subjects: courseSubjects
        };
    })
    // ترتيب الكورسات حسب الأكثر نشاطاً (مجموع الطلاب الكامل + المنفصل)
    .sort((a, b) => (b.fullCount + b.subjects.length) - (a.fullCount + a.subjects.length));

    return res.status(200).json(structuredData);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
