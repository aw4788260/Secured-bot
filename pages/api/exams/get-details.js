import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  const apiName = '[API: exam-details]';
  const { examId } = req.query;
  const userId = req.headers['x-user-id'];

  console.log(`${apiName} 🚀 Request for Exam: ${examId} by User: ${userId}`);

  if (!examId) return res.status(400).json({ error: 'Missing examId' });

  try {
    console.log(`${apiName} 🔒 Checking permissions...`);
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        return res.status(403).json({ error: 'Access Denied' });
    }

    console.log(`${apiName} 🔍 Fetching exam info...`);
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration_minutes, requires_student_name')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
        console.error(`${apiName} ❌ Exam not found in DB.`);
        return res.status(404).json({ error: 'Exam not found' });
    }

    console.log(`${apiName} 🔍 Checking previous attempts...`);
    const { count } = await supabase
      .from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .match({ user_id: userId, exam_id: examId, status: 'completed' }); 

    if (count > 0) {
      console.warn(`${apiName} ⚠️ User already completed this exam.`);
      return res.status(403).json({ error: 'لقد قمت بإنهاء هذا الامتحان من قبل.' });
    }

    console.log(`${apiName} ✅ Success. Sending details.`);
    return res.status(200).json({ exam });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};
