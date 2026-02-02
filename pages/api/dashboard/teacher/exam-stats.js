import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (مدرس أو أدمن)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const teacherId = user.teacherId;
  const { examId } = req.query;

  if (!examId) {
    return res.status(400).json({ error: 'Exam ID is required' });
  }

  try {
    // 🛡️ خطوة أمان إضافية: التحقق من أن المدرس يملك هذا الامتحان
    const { data: exam, error: examCheckError } = await supabase
      .from('exams')
      .select('id, teacher_id, title')
      .eq('id', examId)
      .single();

    if (examCheckError || !exam) {
      return res.status(404).json({ error: 'الامتحان غير موجود' });
    }

    if (String(exam.teacher_id) !== String(teacherId)) {
      return res.status(403).json({ error: 'غير مصرح لك بمشاهدة إحصائيات هذا الامتحان' });
    }

    // ============================================================
    // ✅ المنطق الذي طلبته (نفس الكود المرسل)
    // ============================================================
    
    // جلب المحاولات مع بيانات المستخدم (الاسم الأول والهاتف فقط كما طلبت)
    const { data: attempts, error: fetchError } = await supabase
        .from('user_attempts') 
        .select('score, percentage, student_name_input, completed_at, users(first_name, phone)')
        .eq('exam_id', examId)
        .eq('status', 'completed')
        .order('percentage', { ascending: false });

    if (fetchError) throw fetchError;

    // حالة عدم وجود محاولات
    if (!attempts || attempts.length === 0) {
        return res.status(200).json({ 
            averageScore: 0, 
            averagePercentage: 0,
            topStudents: [], 
            totalAttempts: 0,
            examTitle: exam.title // إضافة العنوان للعرض
        });
    }

    const totalAttempts = attempts.length;
    
    // حساب متوسط الدرجات
    const averageScore = totalAttempts > 0 
        ? (attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // حساب متوسط النسبة المئوية
    const averagePercentage = totalAttempts > 0 
        ? (attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // تجهيز قائمة أفضل 10 طلاب
    const topStudents = attempts.slice(0, 10).map(a => ({
        // الأولوية للاسم المدخل يدوياً، ثم الاسم المسجل، ثم قيمة افتراضية
        name: a.student_name_input || a.users?.first_name || 'طالب غير مسجل',
        phone: a.users?.phone || 'غير متوفر',
        score: a.score || 0,
        percentage: a.percentage || 0,
        date: a.completed_at
    }));

    // إرجاع البيانات
    return res.status(200).json({ 
        averageScore, 
        averagePercentage, 
        totalAttempts, 
        topStudents,
        examTitle: exam.title
    });

  } catch (err) {
    console.error("Exam Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
