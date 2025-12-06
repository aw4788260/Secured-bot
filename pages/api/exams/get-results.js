import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const apiName = '[API: get-results]';
  const { attemptId } = req.query;
  const userId = req.headers['x-user-id'];

  console.log(`${apiName} 🚀 Requesting results for Attempt: ${attemptId} by User: ${userId}`);

  if (!attemptId || !userId) return res.status(400).json({ error: 'Missing Data' });

  try {
    const { data: attempt } = await supabase
      .from('user_attempts')
      .select('id, score, question_order, user_id, exams ( id, title )')
      .eq('id', attemptId)
      .single();

    if (!attempt) {
        console.error(`${apiName} ❌ Attempt not found.`);
        return res.status(404).json({ error: 'Results not found' });
    }

    if (String(attempt.user_id) !== String(userId)) {
        console.warn(`${apiName} ⛔ Access Denied. User mismatch.`);
        return res.status(403).json({ error: 'Access Denied: Not your result' });
    }

    console.log(`${apiName} 📊 Fetching QA data...`);
    const { data: questions } = await supabase.from('questions')
      .select(`id, question_text, image_file_id, options ( id, option_text, is_correct )`)
      .eq('exam_id', attempt.exams.id);

    const { data: userAnswers } = await supabase.from('user_answers')
      .select('question_id, selected_option_id, is_correct')
      .eq('attempt_id', attemptId);

    const userAnsMap = new Map();
    userAnswers?.forEach(ans => userAnsMap.set(ans.question_id, ans));

    // ترتيب
    const orderedQuestions = [];
    if (attempt.question_order) {
        const qMap = new Map(questions.map(q => [q.id, q]));
        attempt.question_order.forEach(id => { if (qMap.has(id)) orderedQuestions.push(qMap.get(id)); });
    } else {
        orderedQuestions.push(...questions);
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

    console.log(`${apiName} ✅ Sending results.`);
    return res.status(200).json({
        exam_title: attempt.exams.title,
        score_details: { percentage: attempt.score, correct: correctCount, total: questions.length },
        corrected_questions: finalQuestions
    });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
