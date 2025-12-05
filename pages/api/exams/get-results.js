import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { attemptId } = req.query;
  const userId = req.headers['x-user-id']; // [✅]

  if (!attemptId || !userId) return res.status(400).json({ error: 'Missing Data' });

  try {
    // 1. جلب المحاولة
    const { data: attempt } = await supabase
      .from('user_attempts')
      .select('id, score, question_order, user_id, exams ( id, title )')
      .eq('id', attemptId)
      .single();

    if (!attempt) return res.status(404).json({ error: 'Results not found' });

    // [🔒] التحقق: هل المستخدم هو صاحب النتيجة؟
    if (String(attempt.user_id) !== String(userId)) {
        return res.status(403).json({ error: 'Access Denied: Not your result' });
    }

    // 2. جلب الأسئلة وترتيبها
    const { data: questions } = await supabase.from('questions')
      .select(`id, question_text, image_file_id, options ( id, option_text, is_correct )`)
      .eq('exam_id', attempt.exams.id);

    const { data: userAnswers } = await supabase.from('user_answers')
      .select('question_id, selected_option_id, is_correct')
      .eq('attempt_id', attemptId);

    const userAnsMap = new Map();
    userAnswers?.forEach(ans => userAnsMap.set(ans.question_id, ans));

    // ترتيب الأسئلة حسب ما ظهر للطالب
    const orderedQuestions = [];
    if (attempt.question_order) {
        const qMap = new Map(questions.map(q => [q.id, q]));
        attempt.question_order.forEach(id => { if (qMap.has(id)) orderedQuestions.push(qMap.get(id)); });
    } else {
        orderedQuestions.push(...questions); // ترتيب افتراضي
    }

    let correctCount = 0;
    const finalQuestions = orderedQuestions.map(q => {
        const ans = userAnsMap.get(q.id);
        if (ans?.is_correct) correctCount++;
        return {
            ...q,
            correct_option_id: q.options.find(o => o.is_correct)?.id,
            user_answer: ans || null
        };
    });

    return res.status(200).json({
        exam_title: attempt.exams.title,
        score_details: { percentage: attempt.score, correct: correctCount, total: questions.length },
        corrected_questions: finalQuestions
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
