import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // 🛠️ دالة تحويل التوقيت
  const toEgyptUTC = (dateString) => {
      if (!dateString) return null;
      try {
        const cleanDate = dateString.replace('Z', '');
        const dateAsUtc = new Date(cleanDate + 'Z');
        if (isNaN(dateAsUtc.getTime())) return null;
        
        // حساب الإزاحة الزمنية للقاهرة
        const timeZone = 'Africa/Cairo';
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
        const parts = fmt.formatToParts(dateAsUtc);
        const offsetPart = parts.find(p => p.type === 'timeZoneName').value;
        const offsetHours = parseInt(offsetPart.replace(/[^\d+-]/g, ''));
        
        // تعديل الوقت
        dateAsUtc.setHours(dateAsUtc.getHours() - offsetHours);
        return dateAsUtc.toISOString();
      } catch (e) {
        console.error("Time conversion error:", e);
        return null;
      }
  };

  // --- معالجة الطلبات (POST): إنشاء، تحديث، أو حذف ---
  if (req.method === 'POST') {
      
      // استقبال البيانات
      let examData = req.body;
      let action = 'create'; // الافتراضي

      // دعم هيكلية action/payload أو البيانات المباشرة
      if (req.body.action && req.body.payload) {
          action = req.body.action;
          examData = req.body.payload;
      } else if (req.body.examId) {
          // إذا تم إرسال examId بدون تحديد action، نعتبره تحديث
          action = 'update';
      }

      const { title, subjectId, duration, questions, start_time, end_time, examId } = examData;

      try {
        let targetExamId = examId;

        // =================================================
        // الحالة 3 (الجديدة): حذف امتحان (Delete)
        // =================================================
        if (action === 'delete') {
            if (!examId) return res.status(400).json({ error: 'Exam ID required for delete' });

            // 1. حذف محاولات الطلاب المرتبطة بالامتحان أولاً (Foreign Key Constraint)
            await supabase.from('user_attempts').delete().eq('exam_id', examId);
            
            // 2. حذف الأسئلة (سيتم حذف الخيارات تلقائياً بفضل Cascade في قاعدة البيانات)
            await supabase.from('questions').delete().eq('exam_id', examId);

            // 3. حذف الامتحان نفسه
            const { error: deleteErr } = await supabase
                .from('exams')
                .delete()
                .eq('id', examId)
                .eq('teacher_id', auth.teacherId); // أمان: المعلم يحذف امتحاناته فقط

            if (deleteErr) throw deleteErr;

            return res.status(200).json({ success: true, message: 'Exam and all related data deleted' });
        }
        
        // =================================================
        // الحالة 1: إنشاء امتحان جديد (Create)
        // =================================================
        else if (action === 'create') {
            if (!title || !subjectId) return res.status(400).json({ error: 'بيانات الامتحان ناقصة' });

            const adjustedStartTime = toEgyptUTC(start_time);
            const adjustedEndTime = toEgyptUTC(end_time);

            const { data: newExam, error: examErr } = await supabase.from('exams').insert({
                title, 
                subject_id: subjectId,
                duration_minutes: duration,
                requires_student_name: true,
                randomize_questions: true,
                sort_order: 999,
                teacher_id: auth.teacherId,
                start_time: adjustedStartTime,
                end_time: adjustedEndTime,
                is_active: true 
            }).select().single();

            if (examErr) throw examErr;
            targetExamId = newExam.id;
        } 
        // =================================================
        // الحالة 2: تحديث امتحان موجود (Update)
        // =================================================
        else if (action === 'update') {
            if (!targetExamId) return res.status(400).json({ error: 'Exam ID required for update' });

            const adjustedStartTime = toEgyptUTC(start_time);
            const adjustedEndTime = toEgyptUTC(end_time);

            // 1. تحديث بيانات الامتحان الأساسية
            const { error: updateErr } = await supabase.from('exams').update({
                title,
                duration_minutes: duration,
                start_time: adjustedStartTime,
                end_time: adjustedEndTime,
            })
            .eq('id', targetExamId)
            .eq('teacher_id', auth.teacherId); // أمان: التأكد أن المعلم هو صاحب الامتحان

            if (updateErr) throw updateErr;

            // ✅ التعديل الجديد: حذف جميع محاولات الطلاب لهذا الامتحان لضمان التوافق مع التعديلات
            // هذا سيؤدي أيضاً إلى حذف الإجابات المرتبطة بالمحاولات إذا كانت العلاقة cascade
            await supabase.from('user_attempts').delete().eq('exam_id', targetExamId);

            // 2. حذف الأسئلة القديمة (سيتم حذف الخيارات تلقائياً بسبب Cascade)
            await supabase.from('questions').delete().eq('exam_id', targetExamId);
        }

        // =================================================
        // إدخال الأسئلة (مشترك للإنشاء والتحديث فقط)
        // =================================================
        if (action !== 'delete' && questions && questions.length > 0) {
            for (const [index, q] of questions.entries()) {
                const { data: newQ, error: qErr } = await supabase.from('questions').insert({
                    exam_id: targetExamId, 
                    question_text: q.text,
                    image_file_id: q.image || null,
                    sort_order: index,
                }).select().single();

                if (qErr) console.error("Error creating question:", qErr);

                // إضافة الخيارات
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

        return res.status(200).json({ 
            success: true, 
            examId: targetExamId, 
            message: action === 'update' ? 'Exam Updated' : 'Exam Created' 
        });

      } catch (err) {
          console.error("Exam Operation Error:", err);
          return res.status(500).json({ error: err.message });
      }
  }

  // --- GET: إحصائيات امتحان ---
  if (req.method === 'GET') {
      const { examId } = req.query;
      
      const { data: attempts } = await supabase
          .from('user_attempts') 
          .select('score, percentage, student_name_input, completed_at, users(first_name, phone)')
          .eq('exam_id', examId)
          .eq('status', 'completed')
          .order('percentage', { ascending: false });

      if (!attempts) return res.status(200).json({ 
          averageScore: 0, 
          averagePercentage: 0,
          topStudents: [], 
          totalAttempts: 0 
      });

      const totalAttempts = attempts.length;
      
      const averageScore = totalAttempts > 0 
          ? (attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalAttempts).toFixed(1) 
          : 0;

      const averagePercentage = totalAttempts > 0 
          ? (attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalAttempts).toFixed(1) 
          : 0;

      const topStudents = attempts.slice(0, 10).map(a => ({
          name: a.student_name_input || a.users?.first_name || 'طالب غير مسجل',
          phone: a.users?.phone || 'غير متوفر',
          score: a.score || 0,
          percentage: a.percentage || 0,
          date: a.completed_at
      }));

      return res.status(200).json({ 
          averageScore, 
          averagePercentage, 
          totalAttempts, 
          topStudents 
      });
  }
};
