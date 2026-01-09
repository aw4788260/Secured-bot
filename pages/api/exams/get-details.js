import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  const apiName = '[API: exam-details]';
  
  // 1. استقبال البيانات من الهيدر (أكثر أماناً)
  const { examId } = req.query;
  const userId = req.headers['x-user-id'];

  console.log(`${apiName} 🚀 Request for Exam: ${examId} by User: ${userId}`);

  if (!examId || !userId) return res.status(400).json({ error: 'Missing Data' });

  try {
    // 2. التحقق الأمني الشامل (الجهاز + الاشتراك)
    // نمرر نوع المورد 'exam' ليقوم authHelper بالتحقق من ملكية المادة التابع لها هذا الامتحان
    console.log(`${apiName} 🔒 Checking permissions...`);
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        return res.status(403).json({ error: 'Access Denied: Unauthorized Device or Subscription' });
    }

    // 3. جلب تفاصيل الامتحان
    console.log(`${apiName} 🔍 Fetching exam info...`);
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration_minutes, requires_student_name')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
        return res.status(404).json({ error: 'Exam not found' });
    }

    // 4. التحقق من المحاولات السابقة (منع الإعادة)
    const { count } = await supabase
      .from('user_attempts')
      .select('id', { count: 'exact', head: true })
      .match({ user_id: userId, exam_id: examId, status: 'completed' }); 

    if (count > 0) {
      console.warn(`${apiName} ⚠️ User already completed this exam.`);
      // نرسل رمز خاص (409 Conflict) ليفهم التطبيق أن الامتحان محلول
      return res.status(409).json({ 
          error: 'لقد قمت بإنهاء هذا الامتحان من قبل.',
          isCompleted: true 
      });
    }

    console.log(`${apiName} ✅ Success.`);
    return res.status(200).json({ exam });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};
