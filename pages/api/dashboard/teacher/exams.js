import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من صلاحية المعلم (داشبورد)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم التعامل معه في الدالة المساعدة

  const teacherId = user.teacherId;

  // 🛠️ دالة تحويل التوقيت
  const toEgyptUTC = (dateString) => {
      if (!dateString) return null;
      try {
        const cleanDate = dateString.replace('Z', '');
        const dateAsUtc = new Date(cleanDate + 'Z');
        if (isNaN(dateAsUtc.getTime())) return null;
        
        const timeZone = 'Africa/Cairo';
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
        const parts = fmt.formatToParts(dateAsUtc);
        const offsetPart = parts.find(p => p.type === 'timeZoneName').value;
        const offsetHours = parseInt(offsetPart.replace(/[^\d+-]/g, ''));
        
        dateAsUtc.setHours(dateAsUtc.getHours() - offsetHours);
        return dateAsUtc.toISOString();
      } catch (e) {
        console.error("Time conversion error:", e);
        return null;
      }
  };

  if (req.method === 'POST') {
      let examData = req.body;
      let action = 'create';

      if (req.body.action && req.body.payload) {
          action = req.body.action;
          examData = req.body.payload;
      } else if (req.body.examId) {
          action = 'update';
      }

      const { 
        title, subjectId, duration, questions, start_time, end_time, examId,
        randomizeQuestions, randomizeOptions 
      } = examData;

      try {
        let targetExamId = examId;

        // --- حذف امتحان ---
        if (action === 'delete') {
            if (!examId) return res.status(400).json({ error: 'Exam ID required' });

            // حذف البيانات المرتبطة
            await supabase.from('user_attempts').delete().eq('exam_id', examId);
            await supabase.from('questions').delete().eq('exam_id', examId);

            // حذف الامتحان (مع التحقق من الملكية)
            const { error: deleteErr } = await supabase
                .from('exams')
                .delete()
                .eq('id', examId)
                .eq('teacher_id', teacherId); // 🔒 حماية

            if (deleteErr) throw deleteErr;
            return res.status(200).json({ success: true, message: 'Deleted' });
        }
        
        // --- إنشاء امتحان ---
        else if (action === 'create') {
            if (!title || !subjectId) return res.status(400).json({ error: 'Missing data' });

            // 🔒 التحقق من ملكية المادة
            const { data: subjectInfo } = await supabase
                .from('subjects')
                .select('courses!inner(teacher_id)')
                .eq('id', subjectId)
                .single();
            
            if (!subjectInfo || subjectInfo.courses.teacher_id !== teacherId) {
                return res.status(403).json({ error: 'لا تملك صلاحية إضافة امتحان لهذه المادة' });
            }

            const adjustedStartTime = toEgyptUTC(start_time);
            const adjustedEndTime = toEgyptUTC(end_time);

            const { data: newExam, error: examErr } = await supabase.from('exams').insert({
                title, 
                subject_id: subjectId,
                duration_minutes: duration,
                requires_student_name: true,
                sort_order: 999,
                teacher_id: teacherId, // ✅ ربط بالمدرس
                start_time: adjustedStartTime,
                end_time: adjustedEndTime,
                is_active: true,
                randomize_questions: randomizeQuestions || false,
                randomize_options: randomizeOptions || false
            }).select().single();

            if (examErr) throw examErr;
            targetExamId = newExam.id;
        } 
        // --- تحديث امتحان ---
        else if (action === 'update') {
            if (!targetExamId) return res.status(400).json({ error: 'Exam ID required' });

            const adjustedStartTime = toEgyptUTC(start_time);
            const adjustedEndTime = toEgyptUTC(end_time);

            const { error: updateErr } = await supabase.from('exams').update({
                title,
                duration_minutes: duration,
                start_time: adjustedStartTime,
                end_time: adjustedEndTime,
                randomize_questions: randomizeQuestions || false,
                randomize_options: randomizeOptions || false
            })
            .eq('id', targetExamId)
            .eq('teacher_id', teacherId); // 🔒 حماية

            if (updateErr) throw updateErr;

            // إعادة بناء الأسئلة
            await supabase.from('user_attempts').delete().eq('exam_id', targetExamId);
            await supabase.from('questions').delete().eq('exam_id', targetExamId);
        }

        // --- إدخال الأسئلة ---
        if (action !== 'delete' && questions && questions.length > 0) {
            for (const [index, q] of questions.entries()) {
                const { data: newQ } = await supabase.from('questions').insert({
                    exam_id: targetExamId, 
                    question_text: q.text,
                    image_file_id: q.image || null,
                    sort_order: index,
                }).select().single();

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

        return res.status(200).json({ success: true, examId: targetExamId });
      } catch (err) {
          console.error("Exam Op Error:", err);
          return res.status(500).json({ error: err.message });
      }
  }
};
