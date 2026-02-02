import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  console.log(`[ExamStats] Request started: ${req.method}`);

  try {
    // 1. التحقق من الصلاحية
    const { user, error } = await requireTeacherOrAdmin(req, res);
    if (error) return res.status(401).json({ error: 'Unauthorized' });

    const teacherId = user.teacherId;
    const { examId } = req.query;

    if (!examId) return res.status(400).json({ error: 'Exam ID is required' });

    // 2. التحقق من الملكية
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, teacher_id')
      .eq('id', examId)
      .single();

    if (examError || !exam) return res.status(404).json({ error: 'Exam not found' });

    if (user.role !== 'admin' && String(exam.teacher_id) !== String(teacherId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 3. جلب المحاولات
    const { data: attemptsData, error: attemptsError } = await supabase
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

    // 4. معالجة البيانات وتنسيقها لتطابق الفرونت اند
    const totalAttempts = attemptsData ? attemptsData.length : 0;
    let averageScore = 0;
    
    // ملاحظة: الفرونت يستخدم averageScore في مكانين (كنسبة وكدرجة)، لذا سنرسل القيمتين
    
    if (totalAttempts > 0) {
      const sumScore = attemptsData.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
      averageScore = (sumScore / totalAttempts).toFixed(1);
    }

    // تجهيز المصفوفة بنفس الأسماء التي يطلبها الفرونت (attempts, student_name_input, completed_at)
    const formattedAttempts = attemptsData ? attemptsData.map((attempt) => {
      // استخراج الاسم
      const userData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
      const finalName = attempt.student_name_input || userData?.first_name || 'طالب غير مسجل';
      
      return {
        // ✅ استخدام نفس المفاتيح الموجودة في الفرونت اند
        student_name_input: finalName, 
        score: attempt.score,
        percentage: attempt.percentage,
        completed_at: attempt.completed_at, // الفرونت يستخدم completed_at
        phone: userData?.phone // إضافة إضافية لو احتجتها
      };
    }) : [];

    console.log(`[ExamStats] Sending Response. Total: ${totalAttempts}`);

    // إرسال الرد بالهيكل المتوقع
    return res.status(200).json({
      examTitle: exam.title,
      averageScore: averageScore, // الفرونت يستخدم هذا المفتاح
      totalAttempts: totalAttempts, // الفرونت يستخدم هذا المفتاح
      attempts: formattedAttempts // ✅ تم التعديل من topStudents إلى attempts
    });

  } catch (err) {
    console.error("❌ [ExamStats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
