import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // --- إنشاء امتحان جديد (Create) ---
  if (req.method === 'POST') {
      
      let examData = req.body;
      if (req.body.action === 'create' && req.body.payload) {
          examData = req.body.payload;
      }

      const { title, subjectId, duration, questions, start_time, end_time } = examData;

      if (!title || !subjectId) {
          return res.status(400).json({ error: 'بيانات الامتحان ناقصة (العنوان أو المادة)' });
      }

      // 🛠️ دالة مساعدة لتصحيح فرق التوقيت (إنقاص ساعة واحدة)
      // هذا يحل مشكلة أن السيرفر متأخر ساعة عن توقيت مصر
      const adjustTimeForServer = (dateString) => {
          if (!dateString) return null;
          const date = new Date(dateString);
          // ننقص ساعة واحدة (60 دقيقة) ليتم الحفظ بتوقيت السيرفر
          date.setHours(date.getHours() - 1); 
          return date.toISOString();
      };

      // تطبيق تصحيح الوقت
      const adjustedStartTime = adjustTimeForServer(start_time);
      const adjustedEndTime = adjustTimeForServer(end_time);

      // 1. إنشاء الامتحان
      const { data: newExam, error: examErr } = await supabase.from('exams').insert({
          title, 
          subject_id: subjectId,
          duration_minutes: duration,
          requires_student_name: true,
          randomize_questions: true,
          sort_order: 999,
          teacher_id: auth.teacherId,
          start_time: adjustedStartTime, // ✅ تم استخدام الوقت المصحح
          end_time: adjustedEndTime,     // ✅ تم استخدام الوقت المصحح
          is_active: true // ضمان أن يكون الامتحان مفعلاً
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

      const topStudents = attempts.slice(0, 10).map(a => ({
          name: a.student_name_input || a.users?.first_name || 'طالب غير مسجل',
          phone: a.users?.phone || 'غير متوفر',
          score: a.score,
          date: a.completed_at
      }));

      return res.status(200).json({ average, totalAttempts, topStudents });
  }
};
