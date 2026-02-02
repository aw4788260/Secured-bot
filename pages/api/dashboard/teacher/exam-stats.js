// ✅ تأكد من أن المسار يحتوي على 4 مستويات للعودة للمجلد الرئيسي
import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // سجل تتبع لبدء الطلب
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

    console.log(`[ExamStats] Fetching for ExamID: ${examId}, TeacherID: ${teacherId}`);

    if (!examId) {
      return res.status(400).json({ error: 'Exam ID is required' });
    }

    // 2. التحقق من ملكية الامتحان (مع معالجة الأخطاء)
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, teacher_id')
      .eq('id', examId)
      .single();

    if (examError) {
      console.error("[ExamStats] Exam Lookup Error:", examError.message);
      return res.status(404).json({ error: 'الامتحان غير موجود أو حدث خطأ في جلبه' });
    }

    // السماح للأدمن أو صاحب الامتحان فقط
    if (user.role !== 'admin' && user.role !== 'super_admin' && String(exam.teacher_id) !== String(teacherId)) {
      console.error(`[ExamStats] Ownership mismatch. Exam Owner: ${exam.teacher_id}, Requestor: ${teacherId}`);
      return res.status(403).json({ error: 'لا تملك صلاحية عرض إحصائيات هذا الامتحان' });
    }

    // 3. جلب المحاولات (استخدام نفس المنطق المطلوب)
    // نستخدم maybeSingle أو نجلب البيانات بحذر
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

    if (attemptsError) {
      console.error("[ExamStats] Attempts Fetch Error:", attemptsError.message);
      throw attemptsError;
    }

    // 4. معالجة البيانات (تجنب القسمة على صفر)
    const totalAttempts = attempts ? attempts.length : 0;
    let averageScore = 0;
    let averagePercentage = 0;
    let topStudents = [];

    if (totalAttempts > 0) {
      const sumScore = attempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
      const sumPercent = attempts.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
      
      averageScore = (sumScore / totalAttempts).toFixed(1);
      averagePercentage = (sumPercent / totalAttempts).toFixed(1);

      // تجهيز قائمة الطلاب (مع معالجة احتمال أن يكون users مصفوفة أو كائن)
      topStudents = attempts.slice(0, 50).map((attempt) => {
        // استخراج بيانات المستخدم بأمان
        const userData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
        
        // تحديد الاسم: إما المدخل يدوياً أو المسجل في الحساب
        const name = attempt.student_name_input || (userData?.first_name) || 'طالب';
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

    console.log(`[ExamStats] Success. Total Attempts: ${totalAttempts}`);

    // 5. إرجاع النتيجة
    return res.status(200).json({
      success: true,
      examTitle: exam.title,
      totalAttempts,
      averageScore,
      averagePercentage,
      topStudents
    });

  } catch (err) {
    console.error("❌ [ExamStats] CRITICAL ERROR:", err);
    // إرجاع رسالة خطأ واضحة بدلاً من Application Error الصامت
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
};
