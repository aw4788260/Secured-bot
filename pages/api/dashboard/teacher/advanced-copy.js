import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من صلاحية المعلم
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return res.status(401).json({ error: 'Unauthorized' });
  const teacherId = user.teacherId;

  // ==========================================================
  // GET: جلب شجرة المحتوى الخاصة بالكورس (لعرضها في الواجهة)
  // ==========================================================
  if (req.method === 'GET') {
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ error: 'Course ID required' });

    try {
      // التحقق من ملكية الكورس
      const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', courseId).single();
      if (!course || course.teacher_id !== teacherId) return res.status(403).json({ error: 'غير مصرح' });

      // جلب شجرة البيانات (المواد -> الفصول -> الفيديوهات/الملفات) + (المواد -> الامتحانات)
      const { data: subjects } = await supabase
        .from('subjects')
        .select(`
          id, title,
          chapters ( id, title, videos (id, title), pdfs (id, title) ),
          exams ( id, title )
        `)
        .eq('course_id', courseId)
        .order('sort_order', { ascending: true });

      return res.status(200).json({ subjects: subjects || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ==========================================================
  // POST: خوارزمية النسخ الذكي (Deep Copy)
  // ==========================================================
  if (req.method === 'POST') {
    const { sourceCourseId, targetCourseId, selected } = req.body;

    if (!sourceCourseId || !targetCourseId || !selected || !selected.subjects) {
      return res.status(400).json({ error: 'بيانات غير مكتملة' });
    }

    try {
      // 1. التحقق من ملكية الكورسين
      const { data: courses } = await supabase.from('courses').select('id, teacher_id').in('id', [sourceCourseId, targetCourseId]);
      if (!courses || courses.length !== 2 || courses.some(c => c.teacher_id !== teacherId)) {
          return res.status(403).json({ error: 'أنت لا تملك صلاحية على هذه الكورسات' });
      }

      // 2. جلب البيانات الأصلية للمواد المحددة فقط بشكل كامل
      const { data: sourceSubjects } = await supabase
        .from('subjects')
        .select(`
          *,
          chapters ( *, videos (*), pdfs (*) ),
          exams ( * )
        `)
        .in('id', selected.subjects);

      // حلقة النسخ (نستخدم for...of لضمان الترتيب وإتمام الوعود Async/Await)
      for (const oldSub of sourceSubjects) {
          
          // أ. نسخ المادة (Subject) - تم إزالة كلمة (نسخة) من هنا
          const { data: newSub } = await supabase.from('subjects').insert({
              course_id: targetCourseId,
              title: oldSub.title, // يتم النسخ بالاسم الأصلي تماماً
              price: oldSub.price,
              sort_order: oldSub.sort_order
          }).select().single();

          const newSubId = newSub.id;

          // ب. نسخ الفصول (Chapters) التابعة للمادة المحددة فقط
          const chaptersToCopy = oldSub.chapters.filter(ch => selected.chapters.includes(ch.id));
          
          for (const oldChap of chaptersToCopy) {
              const { data: newChap } = await supabase.from('chapters').insert({
                  subject_id: newSubId,
                  title: oldChap.title,
                  sort_order: oldChap.sort_order
              }).select().single();

              const newChapId = newChap.id;

              // ج. نسخ الفيديوهات
              const videosToCopy = oldChap.videos.filter(v => selected.videos.includes(v.id)).map(v => ({
                  chapter_id: newChapId,
                  title: v.title,
                  youtube_video_id: v.youtube_video_id,
                  type: v.type,
                  storage_path: v.storage_path,
                  sort_order: v.sort_order
              }));
              if (videosToCopy.length > 0) await supabase.from('videos').insert(videosToCopy);

              // د. نسخ الملفات (PDFs)
              const pdfsToCopy = oldChap.pdfs.filter(p => selected.pdfs.includes(p.id)).map(p => ({
                  chapter_id: newChapId,
                  title: p.title,
                  file_path: p.file_path,
                  sort_order: p.sort_order
              }));
              if (pdfsToCopy.length > 0) await supabase.from('pdfs').insert(pdfsToCopy);
          }

          // هـ. نسخ الامتحانات (Exams)
          const examsToCopy = oldSub.exams.filter(ex => selected.exams.includes(ex.id));
          
          for (const oldExam of examsToCopy) {
              // إدخال الامتحان الجديد
              const { data: newExam } = await supabase.from('exams').insert({
                  subject_id: newSubId,
                  teacher_id: teacherId,
                  title: oldExam.title,
                  duration_minutes: oldExam.duration_minutes,
                  start_time: oldExam.start_time,
                  end_time: oldExam.end_time,
                  requires_student_name: oldExam.requires_student_name,
                  randomize_questions: oldExam.randomize_questions,
                  randomize_options: oldExam.randomize_options,
                  is_active: oldExam.is_active,
                  sort_order: oldExam.sort_order
              }).select().single();

              // جلب أسئلة الامتحان القديم
              const { data: oldQuestions } = await supabase
                .from('questions')
                .select('*, options(*)')
                .eq('exam_id', oldExam.id);

              // نسخ الأسئلة والخيارات
              for (const oldQ of (oldQuestions || [])) {
                  const { data: newQ } = await supabase.from('questions').insert({
                      exam_id: newExam.id,
                      question_text: oldQ.question_text,
                      image_file_id: oldQ.image_file_id,
                      sort_order: oldQ.sort_order
                  }).select().single();

                  if (oldQ.options && oldQ.options.length > 0) {
                      const newOptions = oldQ.options.map(opt => ({
                          question_id: newQ.id,
                          option_text: opt.option_text,
                          is_correct: opt.is_correct,
                          sort_order: opt.sort_order
                      }));
                      await supabase.from('options').insert(newOptions);
                  }
              }
          }
      }

      return res.status(200).json({ success: true, message: 'تم النسخ بنجاح' });

    } catch (err) {
      console.error("Advanced Copy Error:", err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ النسخ' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
