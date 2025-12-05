import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  const { examId } = req.query;
  const userId = req.headers['x-user-id']; // الهوية من الهيدر

  if (!examId) return res.status(400).json({ error: 'Missing examId' });

  try {
    // 1. التحقق الأمني
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    if (!hasAccess) return res.status(403).json({ error: 'Access Denied' });

    // 2. جلب بيانات الامتحان
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration_minutes, requires_student_name')
      .eq('id', examId)
      .single();

    if (examError || !exam) return res.status(404).json({ error: 'Exam not found' });

    // 3. التحقق من المحاولات السابقة (باستخدام userId من الهيدر)
    const { count } = await supabase
      .from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .match({ user_id: userId, exam_id: examId, status: 'completed' }); 

    if (count > 0) {
      return res.status(403).json({ error: 'لقد قمت بإنهاء هذا الامتحان من قبل.' });
    }

    return res.status(200).json({ exam });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
