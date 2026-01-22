import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default async (req, res) => {
  const apiName = '[API: start-attempt]';
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { examId, studentName } = req.body;

  if (!examId) return res.status(400).json({ error: 'Missing Data' });

  // 1. التحقق الأمني الشامل (الحارس)
  // يتحقق من التوكن، الجهاز، واشتراك الطالب في هذا الامتحان
  const hasAccess = await checkUserAccess(req, examId, 'exam');
  
  if (!hasAccess) {
      console.warn(`${apiName} ⛔ Access Denied.`);
      return res.status(403).json({ error: 'Access Denied: Unauthorized Device or Subscription' });
  }

  // 2. استخدام المعرف الآمن
  const userId = req.headers['x-user-id'];
  console.log(`${apiName} 🚀 Starting attempt for Exam: ${examId} by User: ${userId}`);

  try {
    // 🆕 3. جلب إعدادات ووقت الامتحان أولاً (للتحقق قبل البدء)
    const { data: examConfig, error: configError } = await supabase
        .from('exams')
        .select('randomize_questions, randomize_options, start_time, end_time, is_active')
        .eq('id', examId)
        .single();

    if (configError || !examConfig) throw new Error('Exam configuration not found');

    // ✅ التحقق من حالة النشاط
    if (!examConfig.is_active) {
         return res.status(403).json({ error: 'عذراً، هذا الامتحان غير نشط حالياً.' });
    }

    const now = new Date();

    // ✅ التحقق من وقت البداية
    if (examConfig.start_time) {
        const startTime = new Date(examConfig.start_time);
        if (now < startTime) {
            return res.status(403).json({ 
                error: 'عذراً، لم يحن موعد الامتحان بعد.', 
                startTime: examConfig.start_time 
            });
        }
    }

    // ✅ التحقق من وقت النهاية
    if (examConfig.end_time) {
        const endTime = new Date(examConfig.end_time);
        if (now > endTime) {
            return res.status(403).json({ error: 'عذراً، انتهى وقت الامتحان.' });
        }
    }

    // 4. التحقق من الاكتمال (هل أنهى الطالب الامتحان سابقاً؟)
    const { count } = await supabase.from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .match({ user_id: userId, exam_id: examId, status: 'completed' });
    
    if (count > 0) {
        console.warn(`${apiName} ⚠️ Exam already completed.`);
        return res.status(409).json({ error: 'الامتحان مكتمل سابقاً.', isCompleted: true });
    }
    
    // تنظيف المحاولات المعلقة القديمة (In Progress) لنفس الامتحان
    await supabase.from('user_attempts')
        .delete()
        .match({ user_id: userId, exam_id: examId, status: 'started' });

    // 5. إنشاء المحاولة الجديدة
    console.log(`${apiName} 📝 Creating new attempt record...`);
    const { data: newAttempt, error: attError } = await supabase.from('user_attempts').insert({
        user_id: userId,
        exam_id: examId,
        student_name_input: studentName || null,
        status: 'started'
      }).select().single();

    if (attError) throw attError;

    // 6. تجهيز الأسئلة (استخدام الإعدادات التي جلبناها سابقاً)
    console.log(`${apiName} ❓ Fetching and shuffling questions...`);
    
    const { data: questions } = await supabase.from('questions')
      .select(`id, question_text, sort_order, image_file_id, options ( id, question_id, option_text, sort_order )`)
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true })
      .order('sort_order', { foreignTable: 'options', ascending: true });

    let finalQuestions = questions;
    
    // خلط الأسئلة (بناءً على examConfig)
    if (examConfig.randomize_questions) {
        finalQuestions = shuffleArray([...finalQuestions]); 
    }
    
    // خلط الخيارات (بناءً على examConfig)
    if (examConfig.randomize_options) {
        finalQuestions = finalQuestions.map(q => ({ 
            ...q, 
            options: shuffleArray([...q.options]) 
        }));
    }

    // حفظ ترتيب الأسئلة في قاعدة البيانات
    const questionOrder = finalQuestions.map(q => q.id);
    await supabase.from('user_attempts')
        .update({ question_order: questionOrder })
        .eq('id', newAttempt.id);

    console.log(`${apiName} ✅ Exam started. Attempt ID: ${newAttempt.id}`);
    
    // إرجاع البيانات
    return res.status(200).json({ 
        attemptId: newAttempt.id, 
        questions: finalQuestions 
    });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
