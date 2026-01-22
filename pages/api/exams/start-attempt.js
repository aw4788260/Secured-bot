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
  
  // 🔍 1. تسجيل بداية الطلب (Debug Logs)
  console.log(`\n\n🟢 --- START ${apiName} ---`);
  console.log(`${apiName} Method: ${req.method}`);
  console.log(`${apiName} Body:`, JSON.stringify(req.body));
  
  if (req.method !== 'POST') {
      console.log(`${apiName} ⛔ Wrong Method: ${req.method}`);
      return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { examId, studentName } = req.body;

  if (!examId) {
      console.error(`${apiName} ❌ Error: Missing examId`);
      return res.status(400).json({ error: 'Missing Data' });
  }

  try {
    // 2. التحقق الأمني
    console.log(`${apiName} 🛡️ Calling checkUserAccess()...`);
    
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied by AuthHelper.`);
        return res.status(403).json({ error: 'Access Denied: Unauthorized Device or Subscription' });
    }

    // 3. استخراج هوية المستخدم
    const userId = req.headers['x-user-id'];
    console.log(`${apiName} 👤 User Identified: ${userId}`);

    // 4. جلب إعدادات الامتحان (تمت إضافة duration_minutes)
    console.log(`${apiName} 📥 Fetching Exam Config for ID: ${examId}...`);
    
    const { data: examConfig, error: configError } = await supabase
        .from('exams')
        .select('randomize_questions, randomize_options, start_time, end_time, is_active, duration_minutes')
        .eq('id', examId)
        .single();

    if (configError) {
        console.error(`${apiName} 🔥 DB Error (Exam Config):`, configError);
        throw new Error(`Database Error: ${configError.message}`);
    }

    if (!examConfig) {
        console.error(`${apiName} ❌ Exam Not Found in DB`);
        throw new Error('Exam configuration not found');
    }

    // 5. التحقق من التفعيل والوقت
    if (examConfig.is_active === false) {
         console.warn(`${apiName} ⛔ Exam is Inactive`);
         return res.status(403).json({ error: 'عذراً، هذا الامتحان غير نشط حالياً.' });
    }

    const now = new Date();
    
    // التحقق من وقت البداية
    if (examConfig.start_time) {
        const startTime = new Date(examConfig.start_time);
        if (now < startTime) {
            console.warn(`${apiName} ⛔ Too Early. Starts at: ${startTime.toISOString()}`);
            return res.status(403).json({ 
                error: 'عذراً، لم يحن موعد الامتحان بعد.', 
                startTime: examConfig.start_time 
            });
        }
    }

    // ✅ التحقق من انتهاء الوقت (Model Answer Mode)
    let isExpiredMode = false;
    if (examConfig.end_time) {
        const endTime = new Date(examConfig.end_time);
        if (now > endTime) {
            console.warn(`${apiName} ⚠️ Exam Expired. Switching to Model Answer Mode.`);
            isExpiredMode = true; 
        }
    }

    // 6. التحقق من المحاولات السابقة
    const { count } = await supabase.from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .match({ user_id: userId, exam_id: examId, status: 'completed' });
    
    if (count > 0) {
        console.warn(`${apiName} ⚠️ Attempt Rejected: Exam already completed.`);
        return res.status(409).json({ error: 'الامتحان مكتمل سابقاً.', isCompleted: true });
    }
    
    // ✅✅ سيناريو 1: إذا كان الامتحان منتهياً (Expired) -> إرسال نموذج الإجابة
    if (isExpiredMode) {
        // جلب الأسئلة مع الإجابات الصحيحة (is_correct)
        const { data: questionsWithAnswers, error: qAnsError } = await supabase.from('questions')
          .select(`
             id, question_text, sort_order, image_file_id, 
             options ( id, question_id, option_text, sort_order, is_correct )
          `)
          .eq('exam_id', examId)
          .order('sort_order', { ascending: true })
          .order('sort_order', { foreignTable: 'options', ascending: true });

        if (qAnsError) throw qAnsError;

        return res.status(200).json({ 
            mode: 'model_answer', // علامة للفرونت إند
            message: 'انتهى وقت الامتحان، هذا نموذج الإجابة.',
            questions: questionsWithAnswers 
        });
    }

    // ✅✅ سيناريو 2: الامتحان ساري -> بدء محاولة جديدة

    // تنظيف المحاولات المعلقة
    await supabase.from('user_attempts')
        .delete()
        .match({ user_id: userId, exam_id: examId, status: 'started' });

    // إنشاء المحاولة
    const { data: newAttempt, error: attError } = await supabase.from('user_attempts').insert({
        user_id: userId,
        exam_id: examId,
        student_name_input: studentName || null,
        status: 'started'
      }).select().single();

    if (attError) throw attError;

    // جلب الأسئلة (بدون is_correct)
    const { data: questions, error: qError } = await supabase.from('questions')
      .select(`
         id, question_text, sort_order, image_file_id, 
         options ( id, question_id, option_text, sort_order ) 
      `) // ⚠️ هام: لا نرسل is_correct هنا
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true })
      .order('sort_order', { foreignTable: 'options', ascending: true });

    if (qError) throw qError;

    let finalQuestions = questions || [];
    
    // خلط الأسئلة
    if (examConfig.randomize_questions) {
        finalQuestions = shuffleArray([...finalQuestions]); 
    }
    
    // خلط الخيارات
    if (examConfig.randomize_options) {
        finalQuestions = finalQuestions.map(q => ({ 
            ...q, 
            options: shuffleArray([...q.options]) 
        }));
    }

    // حفظ ترتيب الأسئلة
    const questionOrder = finalQuestions.map(q => q.id);
    await supabase.from('user_attempts')
        .update({ question_order: questionOrder })
        .eq('id', newAttempt.id);

    console.log(`${apiName} 🚀 SUCCESS! Attempt ID: ${newAttempt.id}`);
    
    return res.status(200).json({ 
        attemptId: newAttempt.id, 
        questions: finalQuestions,
        durationMinutes: examConfig.duration_minutes || 10 // ✅ إرجاع مدة الامتحان من القاعدة
    });

  } catch (err) {
    console.error(`${apiName} 🔥 FATAL ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
