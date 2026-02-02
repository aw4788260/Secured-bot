import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
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

    // 4. الحسابات (مطابقة للكود الذي طلبته)
    const totalAttempts = attemptsData ? attemptsData.length : 0;
    
    // حساب متوسط الدرجات (Score)
    const averageScore = totalAttempts > 0 
        ? (attemptsData.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // ✅ حساب متوسط النسبة المئوية (Percentage) - تم إضافته كما طلبت
    const averagePercentage = totalAttempts > 0 
        ? (attemptsData.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // 5. تنسيق قائمة الطلاب لتتوافق مع الفرونت اند (attempts array)
    const formattedAttempts = attemptsData ? attemptsData.map((attempt) => {
      const userData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
      const finalName = attempt.student_name_input || userData?.first_name || 'طالب غير مسجل';
      
      return {
        student_name_input: finalName, 
        score: attempt.score,
        percentage: attempt.percentage,
        completed_at: attempt.completed_at,
        phone: userData?.phone
      };
    }) : [];

    // 6. إرسال الرد (شاملاً averagePercentage)
    return res.status(200).json({
      examTitle: exam.title,
      averageScore: averageScore,        // متوسط الدرجات
      averagePercentage: averagePercentage, // ✅ متوسط النسبة المئوية
      totalAttempts: totalAttempts,
      attempts: formattedAttempts       // القائمة
    });

  } catch (err) {
    console.error("❌ [ExamStats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
