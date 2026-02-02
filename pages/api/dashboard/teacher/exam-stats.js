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
    // 2. التحقق من ملكية الامتحان (Security Check)
    // نتحقق من أن الامتحان موجود وأنه يتبع هذا المدرس
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, teacher_id')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return res.status(404).json({ error: 'الامتحان غير موجود' });
    }

    // إذا لم يكن أدمن، يجب أن يتطابق معرف المدرس
    if (String(exam.teacher_id) !== String(teacherId)) {
      return res.status(403).json({ error: 'لا تملك صلاحية عرض إحصائيات هذا الامتحان' });
    }

    // 3. جلب محاولات الطلاب (المكتملة فقط)
    // نقوم بعمل Join مع جدول users لجلب الاسم ورقم الهاتف
    const { data: attempts, error: attemptsError } = await supabase
      .from('user_attempts')
      .select(`
        score,
        percentage,
        student_name_input,
        completed_at,
        users (
          first_name,
          last_name,
          phone
        )
      `)
      .eq('exam_id', examId)
      .eq('status', 'completed')
      .order('percentage', { ascending: false }); // الترتيب من الأعلى للأقل

    if (attemptsError) throw attemptsError;

    // 4. حساب الإحصائيات
    const totalAttempts = attempts.length;
    let averageScore = 0;
    let averagePercentage = 0;

    if (totalAttempts > 0) {
      // جمع الدرجات
      const sumScore = attempts.reduce((acc, curr) => acc + (curr.score || 0), 0);
      const sumPercent = attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      
      // حساب المتوسط
      averageScore = (sumScore / totalAttempts).toFixed(1);
      averagePercentage = (sumPercent / totalAttempts).toFixed(1);
    }

    // 5. تجهيز قائمة أفضل الطلاب (Top Students)
    // نأخذ الاسم إما من المدخل اليدوي (student_name_input) أو من جدول المستخدمين
    const topStudents = attempts.slice(0, 50).map((attempt) => {
      let studentName = attempt.student_name_input;
      if (!studentName && attempt.users) {
        studentName = `${attempt.users.first_name || ''} ${attempt.users.last_name || ''}`.trim();
      }
      
      return {
        name: studentName || 'طالب غير مسجل',
        phone: attempt.users?.phone || 'غير متوفر',
        score: attempt.score,
        percentage: attempt.percentage,
        date: attempt.completed_at
      };
    });

    // 6. إرجاع النتيجة
    return res.status(200).json({
      success: true,
      examTitle: exam.title,
      totalAttempts,
      averageScore,
      averagePercentage,
      topStudents
    });

  } catch (err) {
    console.error("Exam Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
