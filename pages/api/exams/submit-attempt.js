import { supabase } from '../../../lib/supabaseClient';
// يمكن استيراد checkUserAccess إذا أردت التحقق من البصمة هنا أيضاً، 
// لكن في التسليم يكفي التحقق من أن المحاولة تخص المستخدم المرسل في الهيدر.

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // [✅] التعديل الأمني: قراءة الهوية من الهيدرز
  const userId = req.headers['x-user-id'];
  const { attemptId, answers } = req.body;

  if (!attemptId || !answers || !userId) {
    return res.status(400).json({ error: 'Missing Data' });
  }

  try {
    // 1. جلب المحاولة والتحقق من ملكيتها للمستخدم (Security Check)
    const { data: attempt, error: attemptError } = await supabase
      .from('user_attempts')
      .select('id, exam_id, status, user_id') // نجلب user_id للتحقق
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // [🔒] التحقق الأمني: هل المستخدم الذي يرسل الإجابات هو صاحب المحاولة؟
    if (String(attempt.user_id) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized submission (User Mismatch)" });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'تم تسليم هذا الامتحان مسبقاً.' });
    }

    // 2. جلب عدد الأسئلة الكلي
    const { count: totalQuestions, error: countError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('exam_id', attempt.exam_id);

    if (countError) throw countError;
    if (totalQuestions === 0) return res.status(400).json({ error: 'No questions found.' });

    // 3. جلب الإجابات الصحيحة
    const questionIdsAsNumbers = Object.keys(answers).map(id => parseInt(id, 10));
    const { data: correctOptions, error: optionsError } = await supabase
      .from('options')
      .select('id, question_id')
      .eq('is_correct', true)
      .in('question_id', questionIdsAsNumbers);
    
    if (optionsError) throw optionsError;

    const correctAnswersMap = new Map();
    correctOptions.forEach(opt => {
      correctAnswersMap.set(opt.question_id.toString(), opt.id.toString());
    });

    // 4. التصحيح
    let score = 0;
    const userAnswersPayload = []; 

    for (const [questionId, selectedOptionId] of Object.entries(answers)) {
      const correctOptionId = correctAnswersMap.get(questionId); 
      const is_correct = (selectedOptionId.toString() === correctOptionId);

      if (is_correct) score++;

      userAnswersPayload.push({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        is_correct: is_correct
      });
    }

    // 5. حفظ الإجابات
    if (userAnswersPayload.length > 0) {
        const { error: saveAnswersError } = await supabase
        .from('user_answers')
        .insert(userAnswersPayload);
        if (saveAnswersError) throw saveAnswersError;
    }

    // 6. حساب النتيجة وتحديث الحالة
    const percentage = Math.round((score / totalQuestions) * 100);

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
