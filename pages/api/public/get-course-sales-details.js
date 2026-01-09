import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const { courseCode } = req.query;
  const userId = req.headers['x-user-id']; // اختياري (للتحقق من الملكية)

  if (!courseCode) return res.status(400).json({ error: 'Missing Course Code' });

  try {
    // 1. جلب تفاصيل الكورس والمدرس
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select(`
        id, title, price, description, code,
        teacher:teachers (id, name, bio, specialty),
        subjects (id, title, price, sort_order)
      `)
      .eq('code', courseCode)
      .single();

    if (courseError || !course) return res.status(404).json({ error: 'Course not found' });

    // 2. جلب إعدادات الدفع العامة (أو الخاصة بالمدرس لو طبقت ذلك مستقبلاً)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .in('key', ['vodafone_cash_number', 'instapay_number', 'instapay_link']);
    
    const paymentInfo = {};
    settings?.forEach(s => paymentInfo[s.key] = s.value);

    // 3. التحقق من الملكية (إذا كان المستخدم مسجلاً)
    let ownedCourse = false;
    let ownedSubjects = new Set();

    if (userId) {
      // فحص الكورس الكامل
      const { data: cAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .maybeSingle();
      if (cAccess) ownedCourse = true;

      // فحص المواد المنفصلة
      const { data: sAccess } = await supabase
        .from('user_subject_access')
        .select('subject_id')
        .eq('user_id', userId)
        .in('subject_id', course.subjects.map(s => s.id));
      
      sAccess?.forEach(a => ownedSubjects.add(a.subject_id));
    }

    // 4. تنسيق الرد
    return res.status(200).json({
      ...course,
      subjects: course.subjects.sort((a, b) => a.sort_order - b.sort_order).map(s => ({
        ...s,
        isOwned: ownedCourse || ownedSubjects.has(s.id)
      })),
      isOwned: ownedCourse,
      paymentInfo: {
        ...paymentInfo,
        ownerName: course.teacher?.name || 'Admin' 
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
