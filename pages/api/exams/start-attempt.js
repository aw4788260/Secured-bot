import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // [✅] إضافة المحرك الأمني

// دالة خلط المصفوفة
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // [✅] التعديل الأمني: قراءة الهوية من الهيدرز
  const userId = req.headers['x-user-id'];
  const { examId, studentName } = req.body;

  if (!examId || !userId) {
    return res.status(400).json({ error: 'Missing Data (Check Headers/Body)' });
  }

  try {
    // 1. التحقق الأمني الكامل (بصمة + اشتراك)
    // نمرر req كاملة للتحقق من الهيدرز والبصمة
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access Denied: Unauthorized Device or Subscription' });
    }

    // 2. جلب إعدادات الامتحان
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, randomize_questions, randomize_options')
      .eq('id', examId)
      .single();

    if (examError || !exam) return res.status(404).json({ error: 'Exam not found' });

    // 3. التحقق من المحاولات السابقة (محاولة واحدة فقط)
    const { count } = await supabase
      .from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('exam_id', examId)
      .eq('status', 'completed');
    
    if (count > 0) {
      return res.status(403).json({ error: 'لقد قمت بإنهاء هذا الامتحان من قبل.' });
    }
    
    // (تنظيف المحاولات المعلقة السابقة)
    await supabase.from('user_attempts')
        .delete()
        .eq('user_id', userId)
        .eq('exam_id', examId)
        .eq('status', 'started');

    // 4. إنشاء محاولة جديدة
    const { data: newAttempt, error: attemptError } = await supabase
      .from('user_attempts')
      .insert({
        user_id: userId,
        exam_id: examId,
        student_name_input: studentName || null,
        status: 'started'
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // 5. جلب الأسئلة
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        sort_order,
        image_file_id, 
        options ( id, question_id, option_text, sort_order )
      `)
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true })
      .order('sort_order', { foreignTable: 'options', ascending: true });

    if (qError) throw qError;

    // 6. العشوائية وترتيب الأسئلة
    let processedQuestions = questions;
    if (exam.randomize_questions) {
      processedQuestions = shuffleArray(processedQuestions);
    }
    if (exam.randomize_options) {
      processedQuestions = processedQuestions.map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }));
    }
    
    // حفظ ترتيب الأسئلة
    const questionOrder = processedQuestions.map(q => q.id);
    
    const { error: updateOrderError } = await supabase
      .from('user_attempts')
      .update({ question_order: questionOrder }) 
      .eq('id', newAttempt.id);
      
    if (updateOrderError) throw updateOrderError;

    return res.status(200).json({
      attemptId: newAttempt.id,
      questions: processedQuestions
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
