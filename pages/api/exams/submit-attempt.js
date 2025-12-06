import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const apiName = '[API: submit-attempt]';
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = req.headers['x-user-id'];
  const { attemptId, answers } = req.body;

  console.log(`${apiName} 🚀 Submitting Attempt: ${attemptId} by User: ${userId}`);

  if (!attemptId || !userId) return res.status(400).json({ error: 'Missing Data' });

  try {
    const { data: attempt } = await supabase.from('user_attempts').select('id, exam_id, status, user_id').eq('id', attemptId).single();

    if (!attempt) {
        console.error(`${apiName} ❌ Attempt not found.`);
        return res.status(404).json({ error: 'Attempt not found' });
    }
    
    if (String(attempt.user_id) !== String(userId)) {
        console.warn(`${apiName} ⛔ User Mismatch! Owner: ${attempt.user_id}, Requester: ${userId}`);
        return res.status(403).json({ error: "Unauthorized submission" });
    }

    if (attempt.status === 'completed') {
        console.warn(`${apiName} ⚠️ Attempt already completed.`);
        return res.status(400).json({ error: 'تم التسليم مسبقاً' });
    }

    // التصحيح
    console.log(`${apiName} 🧮 Grading...`);
    const { count: totalQuestions } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('exam_id', attempt.exam_id);
    
    const questionIds = Object.keys(answers || {}).map(id => parseInt(id));
    const { data: correctOptions } = await supabase.from('options').select('id, question_id').eq('is_correct', true).in('question_id', questionIds);
    
    const correctMap = new Map();
    correctOptions?.forEach(opt => correctMap.set(opt.question_id.toString(), opt.id.toString()));

    let score = 0;
    const answersPayload = [];

    for (const [qId, optId] of Object.entries(answers || {})) {
        const isCorrect = (optId.toString() === correctMap.get(qId));
        if (isCorrect) score++;
        answersPayload.push({ attempt_id: attemptId, question_id: qId, selected_option_id: optId, is_correct: isCorrect });
    }

    if (answersPayload.length > 0) {
        await supabase.from('user_answers').insert(answersPayload);
    }

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    await supabase.from('user_attempts').update({
        score: percentage, status: 'completed', completed_at: new Date().toISOString()
    }).eq('id', attemptId);

    console.log(`${apiName} ✅ Submitted successfully. Score: ${percentage}%`);
    return res.status(200).json({ success: true, score: percentage });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
