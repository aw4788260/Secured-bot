import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  try {
    // 1. التحقق من الصلاحية (مدرس أو مدير)
    const { user, error } = await requireTeacherOrAdmin(req, res);
    if (error) return res.status(401).json({ error: 'Unauthorized' });

    // استقبال رقم المحاولة من الرابط
    const { attemptId } = req.query;
    if (!attemptId) return res.status(400).json({ error: 'Attempt ID is required' });

    // ========================================================
    // 2. جلب بيانات المحاولة + بيانات الامتحان + بيانات الطالب
    // ========================================================
    const { data: attempt, error: attemptError } = await supabase
      .from('user_attempts')
      .select(`
        id, 
        score, 
        percentage, 
        completed_at, 
        student_name_input, 
        question_order,
        exam_id,
        status,
        is_published,
        exams ( title, teacher_id ),
        users ( first_name, phone )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
        return res.status(404).json({ error: 'لم يتم العثور على نتيجة الطالب' });
    }

    // 🛡️ حماية أمنية: التأكد من أن المدرس يمتلك هذا الامتحان
    if (user.role !== 'admin' && String(attempt.exams.teacher_id) !== String(user.teacherId)) {
      return res.status(403).json({ error: 'غير مصرح لك بمشاهدة هذه النتيجة' });
    }

    // ========================================================
    // 3. جلب الأسئلة والاختيارات الخاصة بهذا الامتحان
    // ========================================================
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select(`
        id, 
        question_text, 
        image_file_id,
        question_type,
        max_score,
        options ( id, option_text, is_correct )
      `)
      .eq('exam_id', attempt.exam_id);

    if (qError) throw qError;

    // ========================================================
    // 4. جلب الإجابات التي اختارها الطالب في هذه المحاولة
    // ========================================================
    const { data: userAnswers, error: uaError } = await supabase
      .from('user_answers')
      .select('question_id, selected_option_id, is_correct, text_answer, earned_score, teacher_feedback')
      .eq('attempt_id', attemptId);

    if (uaError) throw uaError;

    // تحويل إجابات الطالب إلى (Map/Dictionary) لسهولة وسرعة البحث
    const studentAnswersMap = {};
    userAnswers?.forEach(ans => {
      studentAnswersMap[ans.question_id] = ans;
    });

    // ========================================================
    // 5. تنسيق البيانات (وترتيب الأسئلة كما ظهرت للطالب)
    // ========================================================
    let orderedQuestions = [];
    
    // إذا كان هناك ترتيب عشوائي محفوظ للمحاولة، نستخدمه
    if (attempt.question_order && Array.isArray(attempt.question_order)) {
        const qMap = new Map(questions.map(q => [q.id, q]));
        attempt.question_order.forEach(id => {
            if (qMap.has(id)) orderedQuestions.push(qMap.get(id));
        });
    } else {
        // إذا لم يكن هناك ترتيب عشوائي، نعرضها بالترتيب الافتراضي
        orderedQuestions = questions;
    }

    // بناء المصفوفة النهائية التي ستذهب للواجهة الأمامية
    const finalQuestions = orderedQuestions.map(q => {
       const studentAns = studentAnswersMap[q.id]; // جلب إجابة الطالب لهذا السؤال
       const isEssay = q.question_type === 'essay';

       if (isEssay) {
           return {
             id: q.id,
             text: q.question_text,
             image: q.image_file_id,
             question_type: 'essay',
             max_score: q.max_score || 1,
             // إجابة الطالب النصية
             text_answer: studentAns?.text_answer || '',
             // الدرجة التي وضعها المعلم (null إذا لم يتم تصحيحها بعد)
             earned_score: studentAns?.earned_score ?? null,
             teacher_feedback: studentAns?.teacher_feedback || '',
             is_graded: studentAns?.earned_score !== null && studentAns?.earned_score !== undefined
           };
       }

       return {
         id: q.id,
         text: q.question_text,
         image: q.image_file_id,
         question_type: 'mcq',
         options: q.options.map(opt => ({
             id: opt.id,
             text: opt.option_text,
             is_correct: opt.is_correct
         })),
         // معرف الإجابة الصحيحة
         correct_option_id: q.options.find(o => o.is_correct)?.id || null,
         // معرف الإجابة التي اختارها الطالب (قد يكون null إذا ترك السؤال فارغاً)
         student_selected_option_id: studentAns?.selected_option_id || null,
         // هل إجابة الطالب صحيحة؟
         is_student_correct: studentAns?.is_correct || false
       };
    });

    // ========================================================
    // 6. إرسال الرد النهائي
    // ========================================================
    const studentData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
    const hasEssayQuestions = finalQuestions.some(q => q.question_type === 'essay');

    return res.status(200).json({
      success: true,
      student: {
          name: attempt.student_name_input || studentData?.first_name || 'غير مسجل',
          phone: studentData?.phone || 'غير متوفر'
      },
      exam: {
          title: attempt.exams.title,
          score: attempt.score,
          total_questions: finalQuestions.length,
          percentage: attempt.percentage,
          completed_at: attempt.completed_at
      },
      attempt_id: attempt.id,
      status: attempt.status,
      is_published: attempt.is_published,
      has_essay_questions: hasEssayQuestions,
      questions_details: finalQuestions
    });

  } catch (err) {
    console.error("❌ [GetAttemptDetails] Error:", err);
    return res.status(500).json({ error: 'حدث خطأ أثناء جلب تفاصيل الإجابة' });
  }
};
