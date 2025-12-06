import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default async (req, res) => {
  const apiName = '[API: start-attempt]';
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = req.headers['x-user-id'];
  const { examId, studentName } = req.body;

  console.log(`${apiName} 🚀 Starting attempt for Exam: ${examId} by User: ${userId}`);

  if (!examId || !userId) return res.status(400).json({ error: 'Missing Data' });

  try {
    // 1. التحقق الأمني
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        return res.status(403).json({ error: 'Access Denied' });
    }

    // 2. التحقق من الاكتمال
    const { count } = await supabase.from('user_attempts').select('id', { count: 'exact', head: true })
      .match({ user_id: userId, exam_id: examId, status: 'completed' });
    
    if (count > 0) {
        console.warn(`${apiName} ⚠️ Exam already completed.`);
        return res.status(403).json({ error: 'الامتحان مكتمل سابقاً.' });
    }
    
    // تنظيف القديم
    await supabase.from('user_attempts').delete().match({ user_id: userId, exam_id: examId, status: 'started' });

    // 3. إنشاء المحاولة
    console.log(`${apiName} 📝 Creating new attempt record...`);
    const { data: newAttempt, error: attError } = await supabase.from('user_attempts').insert({
        user_id: userId,
        exam_id: examId,
        student_name_input: studentName || null,
        status: 'started'
      }).select().single();

    if (attError) throw attError;

    // 4. تجهيز الأسئلة
    console.log(`${apiName} ❓ Fetching and shuffling questions...`);
    const { data: examConfig } = await supabase.from('exams').select('randomize_questions, randomize_options').eq('id', examId).single();
    
    const { data: questions } = await supabase.from('questions')
      .select(`id, question_text, sort_order, image_file_id, options ( id, question_id, option_text, sort_order )`)
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true })
      .order('sort_order', { foreignTable: 'options', ascending: true });

    let finalQuestions = questions;
    if (examConfig.randomize_questions) finalQuestions = shuffleArray(finalQuestions);
    if (examConfig.randomize_options) {
        finalQuestions = finalQuestions.map(q => ({ ...q, options: shuffleArray(q.options) }));
    }

    // حفظ الترتيب
    const questionOrder = finalQuestions.map(q => q.id);
    await supabase.from('user_attempts').update({ question_order: questionOrder }).eq('id', newAttempt.id);

    console.log(`${apiName} ✅ Exam started. Attempt ID: ${newAttempt.id}`);
    return res.status(200).json({ attemptId: newAttempt.id, questions: finalQuestions });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
