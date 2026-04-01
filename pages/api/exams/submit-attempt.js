import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس

export default async (req, res) => {
  const apiName = '[API: submit-attempt]';
  
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 2. التحقق الأمني (هوية المستخدم وجهازه)
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استخدام المعرف الآمن المحقون
  const userId = req.headers['x-user-id'];
  
  // ✅ استقبال examId ضروري في حالة التدريب لمعرفة أي امتحان نصحح
  const { attemptId, answers, examId } = req.body; // answers format: { "questionId": optionId }

  if (!attemptId || !answers) {
      return res.status(400).json({ error: 'Missing Data' });
  }

  try {
    // =========================================================
    // ✅✅ سيناريو 1: وضع التدريب (الإعادة المؤقتة)
    // =========================================================
    if (attemptId === 'temp_retake_mode') {
        if (!examId) {
            return res.status(400).json({ error: 'Missing Exam ID for practice mode' });
        }

        console.log(`${apiName} 🔄 Grading practice mode for exam: ${examId}`);

        // جلب الإجابات الصحيحة الخاصة بهذا الامتحان مباشرة من قاعدة البيانات
        const { data: questions } = await supabase
          .from('questions')
          .select(`id, options (id, is_correct)`)
          .eq('exam_id', examId);

        let score = 0;
        const total = questions?.length || 0;

        // تصحيح الإجابات في الذاكرة (RAM) فقط بدون حفظ في قاعدة البيانات
        (questions || []).forEach(q => {
          const userSelectedOptionId = answers[q.id];
          const correctOption = q.options.find(o => o.is_correct);
          
          if (correctOption && userSelectedOptionId && String(userSelectedOptionId) === String(correctOption.id)) {
            score++;
          }
        });

        // حساب النسبة المئوية
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

        console.log(`${apiName} ✅ Practice Exam submitted. Score: ${score}/${total} (${percentage}%)`);

        // إرجاع النتيجة مباشرة للفرونت إند دون تنفيذ أي عمليات INSERT أو UPDATE
        return res.status(200).json({
          success: true,
          score: score,
          total: total,
          percentage: percentage,
          is_practice: true // ✅ علامة للتطبيق بأن هذه نتيجة تدريب
        });
    }

    // =========================================================
    // ✅✅ سيناريو 2: المحاولة الحقيقية الأساسية
    // =========================================================
    
    // 4. جلب بيانات المحاولة للتحقق من الملكية
    const { data: attemptData, error: fetchError } = await supabase
        .from('user_attempts')
        .select('exam_id, user_id, status')
        .eq('id', attemptId)
        .single();

    if (fetchError || !attemptData) throw new Error("Attempt not found");

    // 5. التحقق من أن الطالب هو صاحب المحاولة
    if (String(attemptData.user_id) !== String(userId)) {
        console.warn(`${apiName} ⛔ Fraud attempt: User ${userId} tried to submit for ${attemptData.user_id}`);
        return res.status(403).json({ error: "Access Denied: Not your attempt" });
    }

    // التحقق من أن الامتحان لم يتم تسليمه مسبقاً
    if (attemptData.status === 'completed') {
        return res.status(409).json({ error: "Exam already submitted" });
    }

    const realExamId = attemptData.exam_id;

    // 6. جلب الإجابات الصحيحة للمحاولة الحقيقية
    const { data: questions } = await supabase
      .from('questions')
      .select(`id, options (id, is_correct)`)
      .eq('exam_id', realExamId);

    let score = 0;
    const total = questions?.length || 0;
    let answersToInsert = [];

    // 7. تصحيح الإجابات وتجهيزها للحفظ
    (questions || []).forEach(q => {
      const userSelectedOptionId = answers[q.id]; 
      const correctOption = q.options.find(o => o.is_correct);
      
      let isCorrect = false;
      if (correctOption && userSelectedOptionId && String(userSelectedOptionId) === String(correctOption.id)) {
        score++;
        isCorrect = true;
      }

      if (userSelectedOptionId) {
          answersToInsert.push({
              attempt_id: attemptId,
              question_id: q.id,
              selected_option_id: userSelectedOptionId,
              is_correct: isCorrect
          });
      }
    });

    // 8. حفظ الإجابات التفصيلية في جدول user_answers
    if (answersToInsert.length > 0) {
        const { error: ansError } = await supabase
            .from('user_answers')
            .insert(answersToInsert);
        
        if (ansError) throw ansError;
    }

    // ✅ حساب النسبة المئوية
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    // 9. تحديث حالة المحاولة بالدرجة والنسبة ووقت الانتهاء
    const { error: updateError } = await supabase
      .from('user_attempts')
      .update({
        score: score,
        percentage: percentage,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', attemptId);

    if (updateError) throw updateError;

    console.log(`${apiName} ✅ Exam submitted. Score: ${score}/${total} (${percentage}%)`);

    return res.status(200).json({
      success: true,
      score: score,
      total: total,
      percentage: percentage,
      is_practice: false
    });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};
