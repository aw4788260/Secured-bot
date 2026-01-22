import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // --- إنشاء امتحان جديد (Create) ---
  if (req.method === 'POST') {
      
      // ✅ التعديل الأول: استخراج البيانات بشكل صحيح سواء جاءت داخل payload أو مباشرة
      let examData = req.body;
      if (req.body.action === 'create' && req.body.payload) {
          examData = req.body.payload;
      }

      const { title, subjectId, duration, questions, start_time, end_time } = examData;

      // تحقق بسيط لمنع أخطاء قاعدة البيانات
      if (!title || !subjectId) {
          return res.status(400).json({ error: 'بيانات الامتحان ناقصة (العنوان أو المادة)' });
      }

      // 1. إنشاء الامتحان
      const { data: newExam, error: examErr } = await supabase.from('exams').insert({
          title, 
          subject_id: subjectId,
          duration_minutes: duration,
          requires_student_name: true,
          randomize_questions: true,
          sort_order: 999,
          teacher_id: auth.teacherId, // ربط الامتحان بالمعلم
          start_time: start_time || null, 
          end_time: end_time || null      
      }).select().single();

      if (examErr) {
          console.error("Exam Creation Error:", examErr);
          return res.status(500).json({ error: examErr.message });
      }

      // 2. إضافة الأسئلة
      if (questions && questions.length > 0) {
        for (const [index, q] of questions.entries()) {
            const { data: newQ, error: qErr } = await supabase.from('questions').insert({
                exam_id: newExam.id,
                question_text: q.text,
                image_file_id: q.image || null,
                sort_order: index,
            }).select().single();

            if (qErr) console.error("Error creating question:", qErr);

            // 3. إضافة الخيارات
            if (newQ && q.options) {
                const optionsData = q.options.map((optText, i) => ({
                    question_id: newQ.id,
                    option_text: optText,
                    is_correct: i === parseInt(q.correctIndex),
                    sort_order: i
                }));
                await supabase.from('options').insert(optionsData);
            }
        }
      }

      return res.status(200).json({ success: true, examId: newExam.id });
  }

  // --- GET: إحصائيات امتحان ---
  if (req.method === 'GET') {
      const { examId } = req.query;
      
      // جلب المحاولات المكتملة
      // ✅ نطلب هنا users(first_name, phone) لجلب الاسم ورقم الهاتف
      const { data: attempts } = await supabase
          .from('user_attempts') 
          .select('score, student_name_input, completed_at, users(first_name, phone)')
          .eq('exam_id', examId)
          .eq('status', 'completed')
          .order('score', { ascending: false });

      if (!attempts) return res.status(200).json({ average: 0, topStudents: [], totalAttempts: 0 });

      const totalAttempts = attempts.length;
      const average = totalAttempts > 0 
          ? (attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalAttempts).toFixed(1) 
          : 0;

      // ✅ التعديل الثاني: تجهيز قائمة أفضل 10 طلاب مع رقم الهاتف
      const topStudents = attempts.slice(0, 10).map(a => ({
          name: a.student_name_input || a.users?.first_name || 'طالب غير مسجل',
          phone: a.users?.phone || 'غير متوفر', // إظهار الرقم هنا
          score: a.score,
          date: a.completed_at
      }));

      return res.status(200).json({ average, totalAttempts, topStudents });
  }
};
