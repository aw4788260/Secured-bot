import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // سجل تتبع
  console.log(`[ExamStats] Request started: ${req.method}`);

  try {
    // 1. التحقق من الصلاحية
    const { user, error } = await requireTeacherOrAdmin(req, res);
    if (error) {
      console.error("[ExamStats] Auth Failed:", error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const teacherId = user.teacherId;
    const { examId } = req.query;

    if (!examId) {
      return res.status(400).json({ error: 'Exam ID is required' });
    }

    // 2. التحقق من ملكية الامتحان
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, teacher_id')
      .eq('id', examId)
      .single();

    if (examError) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    if (user.role !== 'admin' && String(exam.teacher_id) !== String(teacherId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 3. جلب المحاولات
    const { data: attempts, error: attemptsError } = await supabase
      .from('user_attempts')
      .select(`
        score,
        percentage,
        student_name_input,
        completed_at,
        users (
          first_name,
          phone
        )
      `)
      .eq('exam_id', examId)
      .eq('status', 'completed')
      .order('percentage', { ascending: false });

    if (attemptsError) throw attemptsError;

    // 4. معالجة البيانات
    const totalAttempts = attempts ? attempts.length : 0;
    let averageScore = 0;
    let averagePercentage = 0;
    let topStudents = [];

    if (totalAttempts > 0) {
      const sumScore = attempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
      const sumPercent = attempts.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
      
      averageScore = (sumScore / totalAttempts).toFixed(1);
      averagePercentage = (sumPercent / totalAttempts).toFixed(1);

      topStudents = attempts.slice(0, 50).map((attempt) => {
        const userData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
        const name = attempt.student_name_input || userData?.first_name || 'طالب';
        const phone = userData?.phone || 'غير متوفر';

        return {
          name: name,
          phone: phone,
          score: attempt.score,
          percentage: attempt.percentage,
          date: attempt.completed_at
        };
      });
    }

    console.log(`[ExamStats] Sending Response. Total: ${totalAttempts}`);

    // ✅ التعديل هنا: إزالة 'success: true' لتطابق المثال الذي طلبته تماماً
    // وإرسال البيانات مباشرة كما يتوقعها الفرونت إند المحتمل
    return res.status(200).json({
      examTitle: exam.title, // نحتفظ بالعنوان للفائدة
      averageScore,
      averagePercentage,
      totalAttempts,
      topStudents
    });

  } catch (err) {
    console.error("❌ [ExamStats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
