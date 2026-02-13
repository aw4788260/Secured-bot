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

    // ========================================================
    // ✅ 3. جلب إحصائيات الأسئلة (من الـ View الوهمي في قاعدة البيانات)
    // ========================================================
    const { data: questionStatsData, error: qStatsError } = await supabase
      .from('exam_question_stats')
      .select('*')
      .eq('exam_id', examId);

    // إذا لم يتم إنشاء الـ View في قاعدة البيانات سيطبع تحذيراً
    if (qStatsError) {
        console.warn("⚠️ لم يتم العثور على View إحصائيات الأسئلة، تأكد من تنفيذ كود SQL.", qStatsError.message);
    }

    // ========================================================
    // 4. جلب محاولات الطلاب (مع إضافة id كممثل لـ attempt_id)
    // ========================================================
    const { data: attemptsData, error: attemptsError } = await supabase
      .from('user_attempts')
      .select(`
        id,  
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

    // 5. الحسابات الأساسية
    const totalAttempts = attemptsData ? attemptsData.length : 0;
    
    // حساب متوسط الدرجات (Score)
    const averageScore = totalAttempts > 0 
        ? (attemptsData.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // حساب متوسط النسبة المئوية (Percentage)
    const averagePercentage = totalAttempts > 0 
        ? (attemptsData.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // 6. تنسيق قائمة الطلاب لتتوافق مع الفرونت اند
    const formattedAttempts = attemptsData ? attemptsData.map((attempt) => {
      const userData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
      const finalName = attempt.student_name_input || userData?.first_name || 'طالب غير مسجل';
      
      return {
        attempt_id: attempt.id, // ✅ هذا هو المعرف الذي سيستخدمه المدرس لفتح صفحة تفاصيل إجابات الطالب
        student_name_input: finalName, 
        score: attempt.score,
        percentage: attempt.percentage,
        completed_at: attempt.completed_at,
        phone: userData?.phone
      };
    }) : [];

    // 7. إرسال الرد النهائي (شاملاً الإحصائيات الجديدة)
    return res.status(200).json({
      examTitle: exam.title,
      averageScore: averageScore,        
      averagePercentage: averagePercentage, 
      totalAttempts: totalAttempts,
      attempts: formattedAttempts,         // ✅ قائمة الطلاب + ID المحاولة لكل طالب
      questionStats: questionStatsData || [] // ✅ إحصائيات كل سؤال (عدد الإجابات الصحيحة والخاطئة)
    });

  } catch (err) {
    console.error("❌ [ExamStats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
