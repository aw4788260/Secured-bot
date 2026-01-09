import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { examId, answers } = req.body; // answers: { questionId: optionId }
  const userId = req.headers['x-user-id'];

  try {
    // 1. جلب الإجابات الصحيحة من قاعدة البيانات
    const { data: questions } = await supabase
      .from('questions')
      .select(`id, options (id, is_correct)`)
      .eq('exam_id', examId);

    let score = 0;
    const total = questions.length;

    // 2. حساب النتيجة
    questions.forEach(q => {
      const correctOption = q.options.find(o => o.is_correct);
      const userSelectedOptionId = answers[q.id];
      
      if (correctOption && userSelectedOptionId === correctOption.id) {
        score++;
      }
    });

    // 3. تسجيل المحاولة في قاعدة البيانات
    const { data: attempt, error } = await supabase
      .from('user_attempts')
      .insert({
        user_id: userId,
        exam_id: examId,
        score: score,
        status: 'completed',
        completed_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      score: score,
      total: total,
      percentage: Math.round((score / total) * 100)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
