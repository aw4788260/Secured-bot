// pages/api/exams/get-results.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { attemptId } = req.query;

  if (!attemptId) {
    return res.status(400).json({ error: 'Missing attemptId' });
  }

  try {
    // 1. جلب المحاولة ونتيجنها وعنوان الامتحان
    const { data: attempt, error: attemptError } = await supabase
      .from('user_attempts')
      .select(`
        id,
        score,
        exams ( id, title )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const examId = attempt.exams.id;

    // 2. جلب الأسئلة الكاملة (بالاختيارات) الخاصة بهذا الامتحان
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        options ( id, option_text, is_correct )
      `)
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true }); // (نريد الترتيب الأصلي هنا)

    if (qError) throw qError;

    // 3. جلب إجابات الطالب لهذه المحاولة
    const { data: userAnswers, error: aError } = await supabase
      .from('user_answers')
      .select('question_id, selected_option_id, is_correct')
      .eq('attempt_id', attemptId);

    if (aError) throw aError;

    // (تحويل إجابات الطالب إلى خريطة لسهولة الدمج)
    const userAnswersMap = new Map();
    userAnswers.forEach(ans => {
      userAnswersMap.set(ans.question_id, ans);
    });

    // 4. دمج البيانات (التصحيح)
    let correctCount = 0;
    const corrected_questions = questions.map(q => {
      const userAnswer = userAnswersMap.get(q.id);
      const correctOption = q.options.find(opt => opt.is_correct === true);

      if (userAnswer && userAnswer.is_correct) {
        correctCount++;
      }

      return {
        id: q.id,
        question_text: q.question_text,
        options: q.options,
        correct_option_id: correctOption ? correctOption.id : null,
        user_answer: userAnswer || null // (يحتوي على selected_option_id و is_correct)
      };
    });

    // 5. إعداد النتيجة النهائية
    const score_details = {
      percentage: attempt.score,
      correct: correctCount,
      total: questions.length
    };

    return res.status(200).json({
      exam_title: attempt.exams.title,
      score_details: score_details,
      corrected_questions: corrected_questions
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
