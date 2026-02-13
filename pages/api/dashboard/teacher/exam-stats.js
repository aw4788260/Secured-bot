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
    // ✅ 3. جلب إحصائيات الأسئلة (من الـ View الأول)
    // ========================================================
    const { data: questionStatsData, error: qStatsError } = await supabase
      .from('exam_question_stats')
      .select('*')
      .eq('exam_id', examId);

    if (qStatsError) {
        console.warn("⚠️ لم يتم العثور على View إحصائيات الأسئلة.", qStatsError.message);
    }

    // ========================================================
    // ✅ 4. جلب صور الأسئلة لدمجها مع الإحصائيات
    // ========================================================
    const { data: questionsImages } = await supabase
      .from('questions')
      .select('id, image_file_id')
      .eq('exam_id', examId);

    const imagesMap = {};
    questionsImages?.forEach(q => {
        imagesMap[q.id] = q.image_file_id;
    });

    // ========================================================
    // ✅ 5. جلب إحصائيات الاختيارات (من الـ View الثاني) ودمجها
    // ========================================================
    let optionStatsData = [];
    if (questionStatsData && questionStatsData.length > 0) {
        const questionIds = questionStatsData.map(q => q.question_id);
        
        const { data: optData, error: optError } = await supabase
            .from('exam_option_stats')
            .select('*')
            .in('question_id', questionIds);
            
        if (optError) {
             console.warn("⚠️ لم يتم العثور على View إحصائيات الاختيارات.", optError.message);
        } else {
             optionStatsData = optData || [];
        }
    }

    // دمج الاختيارات والصور داخل كل سؤال لتسهيل العرض في الواجهة
    const formattedQuestionStats = (questionStatsData || []).map(q => ({
        ...q,
        image_file_id: imagesMap[q.question_id] || null, // ✅ إرفاق الصورة
        options: optionStatsData.filter(opt => opt.question_id === q.question_id)
    }));

    // ========================================================
    // 6. جلب محاولات الطلاب (مع إضافة id كممثل لـ attempt_id)
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

    // 7. الحسابات الأساسية
    const totalAttempts = attemptsData ? attemptsData.length : 0;
    
    // حساب متوسط الدرجات (Score)
    const averageScore = totalAttempts > 0 
        ? (attemptsData.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // حساب متوسط النسبة المئوية (Percentage)
    const averagePercentage = totalAttempts > 0 
        ? (attemptsData.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / totalAttempts).toFixed(1) 
        : 0;

    // 8. تنسيق قائمة الطلاب لتتوافق مع الفرونت اند
    const formattedAttempts = attemptsData ? attemptsData.map((attempt) => {
      const userData = Array.isArray(attempt.users) ? attempt.users[0] : attempt.users;
      const finalName = attempt.student_name_input || userData?.first_name || 'طالب غير مسجل';
      
      return {
        attempt_id: attempt.id, 
        student_name_input: finalName, 
        score: attempt.score,
        percentage: attempt.percentage,
        completed_at: attempt.completed_at,
        phone: userData?.phone
      };
    }) : [];

    // 9. إرسال الرد النهائي (شاملاً الإحصائيات الجديدة المدمجة)
    return res.status(200).json({
      examTitle: exam.title,
      averageScore: averageScore,        
      averagePercentage: averagePercentage, 
      totalAttempts: totalAttempts,
      attempts: formattedAttempts,         
      questionStats: formattedQuestionStats // ✅ إحصائيات الأسئلة + الاختيارات + الصور معاً
    });

  } catch (err) {
    console.error("❌ [ExamStats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
