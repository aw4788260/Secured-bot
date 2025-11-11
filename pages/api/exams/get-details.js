// pages/api/exams/get-details.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { examId, userId } = req.query;

  if (!examId || !userId) {
    return res.status(400).json({ error: 'Missing examId or userId' });
  }

  try {
    // 1. جلب تفاصيل الامتحان (لم نعد بحاجة لـ allowed_attempts)
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration_minutes, requires_student_name')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // 2. [✅ تعديل] التحقق إذا أكمل الطالب الامتحان "مرة واحدة"
    const { count, error: countError } = await supabase
      .from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('exam_id', examId)
      .eq('status', 'completed'); 

    if (countError) {
      throw countError;
    }

    // 3. [✅ تعديل] إذا كان قد امتحن (count > 0)، امنعه
    if (count > 0) {
      return res.status(403).json({ error: 'لقد قمت بإنهاء هذا الامتحان من قبل. (محاولة واحدة فقط مسموحة)' });
    }

    // 4. إذا لم يمتحن (count = 0)
    return res.status(200).json({ exam });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
