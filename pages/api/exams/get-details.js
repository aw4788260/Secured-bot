// pages/api/exams/get-details.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { examId, userId } = req.query;

  if (!examId || !userId) {
    return res.status(400).json({ error: 'Missing examId or userId' });
  }

  try {
    // 1. جلب تفاصيل الامتحان
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration_minutes, allowed_attempts, requires_student_name')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // 2. إذا كان عدد المحاولات "غير محدود" (null)، أعد التفاصيل مباشرة
    if (exam.allowed_attempts === null) {
      return res.status(200).json({ exam });
    }

    // 3. إذا كان العدد محدوداً، قم بعد المحاولات السابقة (المكتملة)
    const { count, error: countError } = await supabase
      .from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('exam_id', examId)
      .eq('status', 'completed'); // (نحسب فقط المحاولات المكتملة)

    if (countError) {
      throw countError;
    }

    // 4. المقارنة
    if (count >= exam.allowed_attempts) {
      return res.status(403).json({ error: 'لقد استنفدت جميع محاولاتك المسموحة لهذا الامتحان.' });
    }

    // 5. إذا كان مسموحاً
    return res.status(200).json({ exam });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
