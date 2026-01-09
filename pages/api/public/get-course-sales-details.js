import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const { courseCode } = req.query;
  const userId = req.headers['x-user-id'];

  if (!courseCode) return res.status(400).json({ error: 'Missing Course Code' });

  try {
    // 1. جلب تفاصيل الكورس والمدرس (بما في ذلك معلومات الدفع الخاصة بالمدرس)
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select(`
        id, title, price, description, code,
        teacher:teachers (
            id, name, bio, specialty,
            vodafone_cash_number,
            instapay_number,
            instapay_link
        ),
        subjects (id, title, price, sort_order)
      `)
      .eq('code', courseCode)
      .single();

    if (courseError || !course) return res.status(404).json({ error: 'Course not found' });

    // 2. تجهيز كائن معلومات الدفع بناءً على المدرس
    // إذا لم يكن للمدرس بيانات، يمكن وضع قيم افتراضية أو تركها فارغة
    const paymentInfo = {
        vodafone_cash_number: course.teacher?.vodafone_cash_number || '',
        instapay_number: course.teacher?.instapay_number || '',
        instapay_link: course.teacher?.instapay_link || '',
        ownerName: course.teacher?.name || 'Admin'
    };

    // 3. التحقق من الملكية
    let ownedCourse = false;
    let ownedSubjects = new Set();

    if (userId) {
      const { data: cAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .maybeSingle();
      if (cAccess) ownedCourse = true;

      const { data: sAccess } = await supabase
        .from('user_subject_access')
        .select('subject_id')
        .eq('user_id', userId)
        .in('subject_id', course.subjects.map(s => s.id));
      
      sAccess?.forEach(a => ownedSubjects.add(a.subject_id));
    }

    // 4. إرجاع البيانات
    return res.status(200).json({
      ...course,
      subjects: course.subjects.sort((a, b) => a.sort_order - b.sort_order).map(s => ({
        ...s,
        isOwned: ownedCourse || ownedSubjects.has(s.id)
      })),
      isOwned: ownedCourse,
      paymentInfo: paymentInfo // تم تحديث هذا الجزء ليأخذ من المدرس
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
