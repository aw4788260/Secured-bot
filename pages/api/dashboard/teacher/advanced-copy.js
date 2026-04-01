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

      // جلب شجرة البيانات
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
  // POST: خوارزمية النسخ الذكي (متوافقة 100% مع الجداول)
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

      for (const oldSub of sourceSubjects) {
          
          // أ. نسخ المادة (Subject) بدون إضافة كلمة (نسخة)
          const { data: newSub } = await supabase.from('subjects').insert({
              course_id: targetCourseId,
              title: oldSub.title, 
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

              // ج. نسخ الفيديوهات (نسخ تلقائي لجميع فيديوهات الشابتر المنسوخ)
              // متوافق تماماً مع هيكل جدول الفيديوهات الخاص بك
              if (oldChap.videos && oldChap.videos.length > 0) {
                  const videosToCopy = oldChap.videos.map(v => ({
                      title: v.title,
                      youtube_video_id: v.youtube_video_id || null,
                      sort_order: v.sort_order || 0,
                      chapter_id: newChapId // ربط الفيديو بالشابتر الجديد
                  }));
                  
                  const { error: videoError } = await supabase.from('videos').insert(videosToCopy);
                  if (videoError) console.error("Video Copy Error:", videoError);
              }

              // د. نسخ الملفات (نسخ تلقائي لجميع ملفات الشابتر)
              if (oldChap.pdfs && oldChap.pdfs.length > 0) {
                  const pdfsToCopy = oldChap.pdfs.map(p => ({
                      title: p.title,
                      file_path: p.file_path,
                      sort_order: p.sort_order || 0,
                      chapter_id: newChapId
                  }));
                  
                  const { error: pdfError } = await supabase.from('pdfs').insert(pdfsToCopy);
                  if (pdfError) console.error("PDF Copy Error:", pdfError);
              }
          }

          // هـ. نسخ الامتحانات (Exams)
          const examsToCopy = oldSub.exams.filter(ex => selected.exams.includes(ex.id));
          
          for (const oldExam of examsToCopy) {
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

              const { data: oldQuestions } = await supabase
                .from('questions')
                .select('*, options(*)')
                .eq('exam_id', oldExam.id);

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
