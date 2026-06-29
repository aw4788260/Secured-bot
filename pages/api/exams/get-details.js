import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  const apiName = '[API: exam-details]';
  
  if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { examId } = req.query;

  if (!examId) return res.status(400).json({ error: 'Missing Exam ID' });

  try {
    // 1. التحقق الأمني الشامل (الحارس)
    // نمرر نوع المورد 'exam' ليتحقق من أن الطالب يمتلك المادة التابع لها هذا الامتحان
    const hasAccess = await checkUserAccess(req, examId, 'exam');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        return res.status(403).json({ error: 'Access Denied: Unauthorized Device or Subscription' });
    }

    // 2. استخدام المعرف الآمن (الذي تم حقنه بعد فك التوكن)
    const userId = req.headers['x-user-id'];
    console.log(`${apiName} 🚀 Authorized User: ${userId} requesting Exam: ${examId}`);

    // 3. جلب تفاصيل الامتحان
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration_minutes, requires_student_name')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
        return res.status(404).json({ error: 'Exam not found' });
    }

    // 4. التحقق من المحاولات السابقة (منع الإعادة)
    // ✅ المحاولات المكتملة أو التي بانتظار تصحيح المعلم اليدوي تحجب إعادة الدخول لنفس الامتحان
    const { data: existingAttempt } = await supabase
      .from('user_attempts')
      .select('id, status')
      .match({ user_id: userId, exam_id: examId })
      .in('status', ['completed', 'pending_grading'])
      .limit(1)
      .maybeSingle();

    if (existingAttempt) {
      console.warn(`${apiName} ⚠️ User already submitted this exam (status: ${existingAttempt.status}).`);

      if (existingAttempt.status === 'pending_grading') {
          // نرسل حالة مختلفة ليفهم التطبيق أن الإجابة بانتظار التصحيح اليدوي وليست منتهية بنتيجة
          return res.status(409).json({
              error: 'لقد قمت بتسليم هذا الامتحان من قبل، وهو الآن قيد المراجعة من المعلم.',
              isCompleted: true,
              isPendingGrading: true
          });
      }

      // نرسل رمز 409 (Conflict) ليفهم التطبيق أن الامتحان منتهي
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
