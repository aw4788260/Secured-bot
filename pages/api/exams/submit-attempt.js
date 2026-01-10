import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { attemptId, answers } = req.body; // answers format: { "questionId": optionId }
  const userId = req.headers['x-user-id'];

  if (!attemptId || !answers) {
      return res.status(400).json({ error: 'Missing Data' });
  }

  try {
    // 1. جلب بيانات الامتحان والأسئلة لتصحيح الإجابات
    // نحتاج معرف الامتحان من المحاولة أولاً
    const { data: attemptData, error: fetchError } = await supabase
        .from('user_attempts')
        .select('exam_id')
        .eq('id', attemptId)
        .single();

    if (fetchError || !attemptData) throw new Error("Attempt not found");

    const examId = attemptData.exam_id;

    // جلب الإجابات الصحيحة
    const { data: questions } = await supabase
      .from('questions')
      .select(`id, options (id, is_correct)`)
      .eq('exam_id', examId);

    let score = 0;
    const total = questions.length;
    let answersToInsert = [];

    // 2. تصحيح الإجابات وتجهيز مصفوفة الحفظ
    questions.forEach(q => {
      const userSelectedOptionId = answers[q.id]; // ID الاختيار الذي اختاره الطالب
      const correctOption = q.options.find(o => o.is_correct);
      
      let isCorrect = false;
      if (correctOption && String(userSelectedOptionId) === String(correctOption.id)) {
        score++;
        isCorrect = true;
      }

      // تجهيز الصف لإدخاله في جدول user_answers
      if (userSelectedOptionId) {
          answersToInsert.push({
              attempt_id: attemptId,
              question_id: q.id,
              selected_option_id: userSelectedOptionId,
              is_correct: isCorrect
          });
      }
    });

    // 3. حفظ الإجابات التفصيلية (Bulk Insert)
    if (answersToInsert.length > 0) {
        const { error: ansError } = await supabase
            .from('user_answers')
            .insert(answersToInsert);
        
        if (ansError) {
            throw ansError;
        }
    }

    // 4. تحديث المحاولة بالدرجة النهائية وإنهاء الحالة
    const { error: updateError } = await supabase
      .from('user_attempts')
      .update({
        score: score,
        status: 'completed',
        completed_at: new Date()
      })
      .eq('id', attemptId);

    if (updateError) throw updateError;

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
