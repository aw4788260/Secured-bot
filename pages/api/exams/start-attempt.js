// pages/api/exams/start-attempt.js
import { supabase } from '../../../lib/supabaseClient';

// (دالة مساعدة لخلط الترتيب)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { examId, userId, studentName } = req.body;

  if (!examId || !userId) {
    return res.status(400).json({ error: 'Missing examId or userId' });
  }

  try {
    // 1. (تحقق مرة أخرى من عدد المحاولات للأمان)
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, allowed_attempts, randomize_questions, randomize_options')
      .eq('id', examId)
      .single();

    if (examError || !exam) return res.status(404).json({ error: 'Exam not found' });

    if (exam.allowed_attempts !== null) {
      const { count } = await supabase
        .from('user_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('exam_id', examId)
        .eq('status', 'completed');
      
      if (count >= exam.allowed_attempts) {
        return res.status(403).json({ error: 'لقد استنفدت جميع محاولاتك.' });
      }
    }

    // 2. إنشاء محاولة جديدة (Attempt)
    const { data: newAttempt, error: attemptError } = await supabase
      .from('user_attempts')
      .insert({
        user_id: userId,
        exam_id: examId,
        student_name_input: studentName || null,
        status: 'started'
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // 3. جلب الأسئلة والاختيارات
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        sort_order,
        options ( id, question_id, option_text, sort_order )
      `)
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true })
      .order('sort_order', { foreignTable: 'options', ascending: true });

    if (qError) throw qError;

    // 4. تطبيق العشوائية (إذا طلب الأدمن)
    let processedQuestions = questions;

    // (تطبيق عشوائية الأسئلة)
    if (exam.randomize_questions) {
      processedQuestions = shuffleArray(processedQuestions);
    }

    // (تطبيق عشوائية الاختيارات)
    if (exam.randomize_options) {
      processedQuestions = processedQuestions.map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }));
    }

    return res.status(200).json({
      attemptId: newAttempt.id,
      questions: processedQuestions
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
