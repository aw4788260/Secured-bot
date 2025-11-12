// pages/api/exams/get-results.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { attemptId } = req.query;

  if (!attemptId) {
    return res.status(400).json({ error: 'Missing attemptId' });
  }

  try {
    // 1. جلب المحاولة ونتيجنها وعنوان الامتحان
    // --- [ ✅✅ تعديل: جلب العمود الجديد question_order ] ---
    const { data: attempt, error: attemptError } = await supabase
      .from('user_attempts')
      .select(`
        id,
        score,
        question_order, 
        exams ( id, title )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Results not found' });
    }
    // --- [ نهاية التعديل ] ---

    const examId = attempt.exams.id;

    // 2. جلب الأسئلة الكاملة (بالاختيارات) الخاصة بهذا الامتحان
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        sort_order,
        options ( id, option_text, is_correct )
      `)
      .eq('exam_id', examId);
      // (تم حذف .order() من هنا)

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
    
    // --- [ ✅✅ هذا هو الكود الجديد لحل المشكلة ] ---
    // (إعادة ترتيب الأسئلة بناءً على الترتيب المحفوظ)
    const orderedQuestionIds = attempt.question_order;
    let corrected_questions = [];

    // (إذا كان الترتيب المحفوظ موجوداً، استخدمه)
    if (orderedQuestionIds && orderedQuestionIds.length > 0) {
      // (إنشاء خريطة للأسئلة لسهولة البحث)
      const questionsMap = new Map(questions.map(q => [q.id, q]));
      
      orderedQuestionIds.forEach(qId => {
        const q = questionsMap.get(qId);
        if (q) {
           corrected_questions.push(q);
        }
      });
      
    } else {
      // (خطة بديلة إذا لم يتم حفظ الترتيب لسبب ما)
      corrected_questions = questions.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    // --- [ نهاية الكود الجديد ] ---


    // (الآن، نقوم بمعالجة الأسئلة "المرتبة" بنفس الطريقة القديمة)
    const finalCorrectedQuestions = corrected_questions.map(q => {
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
        user_answer: userAnswer || null 
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
      corrected_questions: finalCorrectedQuestions // (إرسال الأسئلة المرتبة)
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
