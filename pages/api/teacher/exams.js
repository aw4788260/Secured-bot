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

      // 🛠️ دالة ذكية لتحويل توقيت مصر إلى UTC ديناميكياً
      // هذه الدالة تكتشف تلقائياً ما إذا كان التاريخ في الصيف (+3) أو الشتاء (+2)
      const toEgyptUTC = (dateString) => {
          if (!dateString) return null;
          
          try {
            // 1. نعتبر الوقت المدخل هو وقت UTC خام لنحصل على مكونات الوقت
            const cleanDate = dateString.replace('Z', '');
            const dateAsUtc = new Date(cleanDate + 'Z');

            if (isNaN(dateAsUtc.getTime())) return null;

            // 2. نستخدم Intl للحصول على الإزاحة (Offset) الخاصة بمصر في هذا التاريخ تحديداً
            // هذه الدالة ستعيد نصاً مثل "GMT+2" أو "GMT+3" حسب التوقيت الصيفي/الشتوي في ذلك التاريخ
            const timeZone = 'Africa/Cairo';
            const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
            const parts = fmt.formatToParts(dateAsUtc);
            const offsetPart = parts.find(p => p.type === 'timeZoneName').value; // e.g., "GMT+3" or "GMT+2"

            // 3. استخراج الرقم من النص (مثلاً 3 أو 2)
            const offsetHours = parseInt(offsetPart.replace(/[^\d+-]/g, ''));

            // 4. طرح الإزاحة من الوقت الأصلي لتحويله إلى UTC حقيقي يقبله السيرفر
            // إذا كنا في الصيف سيطرح 3، وإذا في الشتاء سيطرح 2 تلقائياً
            dateAsUtc.setHours(dateAsUtc.getHours() - offsetHours);

            return dateAsUtc.toISOString();
          } catch (e) {
            console.error("Time conversion error:", e);
            return null; // في حالة حدوث خطأ نعيد القيمة فارغة
          }
      };

      // تطبيق تصحيح الوقت الذكي
      const adjustedStartTime = toEgyptUTC(start_time);
      const adjustedEndTime = toEgyptUTC(end_time);

      console.log(`Time Input: ${start_time} -> Adjusted UTC: ${adjustedStartTime}`); // للتأكد في اللوج

      // 1. إنشاء الامتحان
      const { data: newExam, error: examErr } = await supabase.from('exams').insert({
          title, 
          subject_id: subjectId,
          duration_minutes: duration,
          requires_student_name: true,
          randomize_questions: true,
          sort_order: 999,
          teacher_id: auth.teacherId,
          start_time: adjustedStartTime, // ✅ توقيت عالمي دقيق
          end_time: adjustedEndTime,     // ✅ توقيت عالمي دقيق
          is_active: true 
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
