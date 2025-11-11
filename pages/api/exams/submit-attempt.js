// pages/api/exams/submit-attempt.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { attemptId, answers } = req.body; // answers = { questionId: optionId, ... }

  if (!attemptId || !answers) {
    return res.status(400).json({ error: 'Missing attemptId or answers' });
  }

  try {
    // 1. جلب المحاولة والتأكد أنها "بدأت"
    const { data: attempt, error: attemptError } = await supabase
      .from('user_attempts')
      .select('id, exam_id, status')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'This attempt has already been submitted.' });
    }

    // --- [ ✅✅ هذا هو الكود الجديد ] ---
    // 1b. جلب العدد "الإجمالي" للأسئلة في هذا الامتحان من قاعدة البيانات
    const { count: totalQuestions, error: countError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('exam_id', attempt.exam_id);

    if (countError) throw countError;
    if (totalQuestions === 0) {
        // (لا يمكن حساب النسبة إذا لم يكن هناك أسئلة)
        return res.status(400).json({ error: 'This exam has no questions.' });
    }
    // --- [ نهاية الكود الجديد ] ---


    // 2. جلب الإجابات الصحيحة للامتحان (الكود سليم من المرة السابقة)
    const questionIdsAsNumbers = Object.keys(answers).map(id => parseInt(id, 10));

    const { data: correctOptions, error: optionsError } = await supabase
      .from('options')
      .select('id, question_id')
      .eq('is_correct', true)
      .in('question_id', questionIdsAsNumbers);
    
    if (optionsError) throw optionsError;

    // (تحويل الإجابات الصحيحة إلى خريطة)
    const correctAnswersMap = new Map();
    correctOptions.forEach(opt => {
      correctAnswersMap.set(opt.question_id.toString(), opt.id.toString());
    });

    // 3. تصحيح الإجابات
    let score = 0;
    // const totalQuestions = Object.keys(answers).length; // <--- 🛑🛑 تم حذف هذا السطر الخاطئ
    const userAnswersPayload = []; 

    for (const [questionId, selectedOptionId] of Object.entries(answers)) {
      
      const correctOptionId = correctAnswersMap.get(questionId); 
      const selectedOptionId_String = selectedOptionId.toString(); 

      const is_correct = (selectedOptionId_String === correctOptionId);

      if (is_correct) {
        score++;
      }

      userAnswersPayload.push({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        is_correct: is_correct
      });
    }

    // 4. حفظ إجابات الطالب
    const { error: saveAnswersError } = await supabase
      .from('user_answers')
      .insert(userAnswersPayload);

    if (saveAnswersError) throw saveAnswersError;

    // 5. حساب النتيجة النهائية وتحديث المحاولة
    // (الآن "totalQuestions" صحيح (2) و "score" صحيح (1))
    const percentage = (totalQuestions > 0) ? Math.round((score / totalQuestions) * 100) : 0;

    const { error: updateAttemptError } = await supabase
      .from('user_attempts')
      .update({
        score: percentage,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', attemptId);

    if (updateAttemptError) throw updateAttemptError;

    return res.status(200).json({ success: true, score: percentage });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
