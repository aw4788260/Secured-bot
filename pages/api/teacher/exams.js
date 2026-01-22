import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // --- إنشاء امتحان جديد (Create) ---
  if (req.method === 'POST') {
      const { title, subjectId, duration, questions } = req.body; // questions: array of {text, options, correctIndex, image}

      // 1. إنشاء الامتحان
      const { data: newExam, error: examErr } = await supabase.from('exams').insert({
          title, 
          subject_id: subjectId,
          duration_minutes: duration,
          requires_student_name: true,
          randomize_questions: true,
          sort_order: 999
      }).select().single();

      if (examErr) return res.status(500).json({ error: examErr.message });

      // 2. إضافة الأسئلة
      for (const [index, q] of questions.entries()) {
          const { data: newQ } = await supabase.from('questions').insert({
              exam_id: newExam.id,
              question_text: q.text,
              image_file_id: q.image || null,
              sort_order: index
          }).select().single();

          // 3. إضافة الخيارات
          const optionsData = q.options.map((optText, i) => ({
              question_id: newQ.id,
              option_text: optText,
              is_correct: i === parseInt(q.correctIndex),
              sort_order: i
          }));
          await supabase.from('options').insert(optionsData);
      }

      return res.status(200).json({ success: true, examId: newExam.id });
  }

  // --- GET: إحصائيات امتحان ---
  if (req.method === 'GET') {
      const { examId } = req.query;
      
      // جلب المحاولات المكتملة
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

      // أفضل 10 طلاب
      const topStudents = attempts.slice(0, 10).map(a => ({
          name: a.student_name_input || a.users?.first_name || 'Unknown',
          phone: a.users?.phone,
          score: a.score,
          date: a.completed_at
      }));

      return res.status(200).json({ average, totalAttempts, topStudents });
  }
};
