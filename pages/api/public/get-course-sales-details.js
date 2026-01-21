import { supabase } from '../../../lib/supabaseClient';
import jwt from 'jsonwebtoken';

export default async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const { courseCode } = req.query;
  
  if (!courseCode) return res.status(400).json({ error: 'Missing Course Code' });

  // 1. "فحص ناعم" (Soft Check) للتعرف على المستخدم إن وجد
  // لا نستخدم authHelper هنا لأننا نسمح للزوار (Guests) بالدخول
  let userId = null;
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          // تحقق إضافي: هل الجهاز مطابق؟
          if (decoded.deviceId === req.headers['x-device-id']) {
              userId = decoded.userId;
          }
      } catch (e) {
          // توكن غير صالح = زائر
      }
  }

  try {
    // 2. جلب تفاصيل الكورس والمدرس
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

    // 3. تجهيز معلومات الدفع
    const paymentInfo = {
        vodafone_cash_number: course.teacher?.vodafone_cash_number || '',
        instapay_number: course.teacher?.instapay_number || '',
        instapay_link: course.teacher?.instapay_link || '',
        ownerName: course.teacher?.name || 'Admin'
    };

    // 4. التحقق من الملكية (فقط إذا تم التعرف على المستخدم)
    let ownedCourse = false;
    let ownedSubjects = new Set();

    if (userId) {
      // أ) هل اشترى الكورس بالكامل؟
      const { data: cAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .maybeSingle();
      
      if (cAccess) ownedCourse = true;

      // ب) هل اشترى مواد منفصلة؟
      const { data: sAccess } = await supabase
        .from('user_subject_access')
        .select('subject_id')
        .eq('user_id', userId)
        .in('subject_id', course.subjects.map(s => s.id));
      
      sAccess?.forEach(a => ownedSubjects.add(a.subject_id));
    }

    // 5. إرجاع البيانات
    return res.status(200).json({
      ...course,
      subjects: course.subjects.sort((a, b) => a.sort_order - b.sort_order).map(s => ({
        ...s,
        isOwned: ownedCourse || ownedSubjects.has(s.id)
      })),
      isOwned: ownedCourse,
      paymentInfo: paymentInfo
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
