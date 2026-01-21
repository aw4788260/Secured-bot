import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // ✅ إضافة الحماية

export default async (req, res) => {
  const apiName = '[API: get-results]';
  const { attemptId } = req.query;

  if (!attemptId) return res.status(400).json({ error: 'Missing Data' });

  try {
    // 1. جلب المحاولة أولاً لمعرفة معرف الامتحان (للتحقق من الصلاحية)
    const { data: attempt, error: attError } = await supabase
      .from('user_attempts')
      .select('id, score, question_order, user_id, exam_id, exams ( id, title )')
      .eq('id', attemptId)
      .single();

    if (attError || !attempt) {
        return res.status(404).json({ error: 'Results not found' });
    }

    // 2. التحقق الأمني الشامل (الحارس)
    // نمرر معرف الامتحان ونوعه ليقوم الحارس بالتحقق من:
    // أ. صحة التوكن
    // ب. مطابقة الجهاز
    // ج. اشتراك الطالب في المادة التابع لها هذا الامتحان
    const isAuthorized = await checkUserAccess(req, attempt.exam_id, 'exam');
    
    if (!isAuthorized) {
        console.warn(`${apiName} ⛔ Access Denied (Token/Device/Subscription mismatch).`);
        return res.status(403).json({ error: 'Unauthorized Device or Expired Subscription' });
    }

    // 3. استخدام المعرف الآمن (الذي حقنه authHelper بعد نجاح التحقق)
    const userId = req.headers['x-user-id'];

    // 4. التحقق من ملكية النتيجة (هل هذا الطالب هو صاحب المحاولة؟)
    if (String(attempt.user_id) !== String(userId)) {
        console.warn(`${apiName} ⛔ Access Denied. User mismatch. AuthUser:${userId} vs AttemptUser:${attempt.user_id}`);
        return res.status(403).json({ error: 'Access Denied: Not your result' });
    }

    // 5. جلب الأسئلة والإجابات
    const { data: questions } = await supabase.from('questions')
      .select(`id, question_text, image_file_id, options ( id, option_text, is_correct )`)
      .eq('exam_id', attempt.exam_id);

    const { data: userAnswers } = await supabase.from('user_answers')
      .select('question_id, selected_option_id, is_correct')
      .eq('attempt_id', attemptId);

    const userAnsMap = new Map();
    userAnswers?.forEach(ans => userAnsMap.set(ans.question_id, ans));

    // 6. إعادة ترتيب الأسئلة حسب الترتيب العشوائي الذي ظهر للطالب
    const orderedQuestions = [];
    if (attempt.question_order && Array.isArray(attempt.question_order)) {
        const qMap = new Map(questions.map(q => [q.id, q]));
        attempt.question_order.forEach(id => { if (qMap.has(id)) orderedQuestions.push(qMap.get(id)); });
    } else {
        orderedQuestions.push(...questions);
    }

    // 7. تجهيز البيانات النهائية
    let correctCount = 0;
    const finalQuestions = orderedQuestions.map(q => {
        const ans = userAnsMap.get(q.id);
        if (ans?.is_correct) correctCount++;
        
        return {
            ...q,
            // نرسل ID الإجابة الصحيحة ليقوم التطبيق بتلوينها
            correct_option_id: q.options.find(o => o.is_correct)?.id,
            // نرسل إجابة الطالب
            user_answer: ans || null
        };
    });

    console.log(`${apiName} ✅ Sending results for Exam: ${attempt.exams.title}`);
    
    return res.status(200).json({
        exam_title: attempt.exams.title,
        score_details: { 
            percentage: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0,
            correct: correctCount, 
            total: questions.length,
            score: attempt.score // الدرجة المسجلة
        },
        corrected_questions: finalQuestions
    });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
