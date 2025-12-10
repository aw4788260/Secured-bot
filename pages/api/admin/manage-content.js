import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  // ---------------------------------------------------------
  // GET: جلب الهيكل بالكامل (بما في ذلك تفاصيل الامتحانات)
  // ---------------------------------------------------------
  if (req.method === 'GET') {
      try {
          const { data: courses, error } = await supabase
              .from('courses')
              .select(`
                  id, title, sort_order, price,
                  subjects (
                      id, title, sort_order, price,
                      chapters (
                          id, title, sort_order,
                          videos (id, title, sort_order, youtube_video_id),
                          pdfs (id, title, sort_order, file_path)
                      ),
                      exams (
                          id, title, duration_minutes, sort_order, 
                          requires_student_name, randomize_questions, randomize_options,
                          questions (
                              id, question_text, image_file_id, sort_order,
                              options (id, option_text, is_correct, sort_order)
                          )
                      )
                  )
              `)
              // الترتيب لضمان ظهور المحتوى بشكل صحيح
              .order('sort_order', { ascending: true })
              .order('sort_order', { foreignTable: 'subjects', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.chapters', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.chapters.videos', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.chapters.pdfs', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.exams', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.exams.questions', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.exams.questions.options', ascending: true });

          if (error) throw error;
          return res.status(200).json(courses);
      } catch (err) {
          return res.status(500).json({ error: err.message });
      }
  }

  // ---------------------------------------------------------
  // POST: العمليات (إضافة / تعديل / حذف)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      const { action, payload } = req.body;

      try {
        if (action === 'add_chapter') {
            await supabase.from('chapters').insert({
                subject_id: payload.subjectId,
                title: payload.title,
                sort_order: 999
            });
            return res.status(200).json({ success: true });
        }

        if (action === 'add_video') {
            const { title, url, chapterId } = payload;
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            const youtubeId = (match && match[2].length === 11) ? match[2] : null;

            if (!youtubeId) return res.status(400).json({ error: 'رابط يوتيوب غير صالح' });

            await supabase.from('videos').insert({
                title, chapter_id: chapterId, youtube_video_id: youtubeId, type: 'youtube', sort_order: 999
            });
            return res.status(200).json({ success: true });
        }

        // --- حفظ أو تعديل الامتحان ---
        if (action === 'save_exam') {
            const { 
                id, // إذا وجد ID فهذا تعديل
                subjectId, title, duration, 
                requiresName, randQ, randO, // الإعدادات الجديدة
                questions, deletedQuestionIds 
            } = payload;
            
            let examId = id;

            // 1. إنشاء أو تحديث بيانات الامتحان الأساسية
            const examData = {
                title,
                duration_minutes: parseInt(duration),
                requires_student_name: requiresName,
                randomize_questions: randQ,
                randomize_options: randO
            };

            if (examId) {
                // تحديث
                await supabase.from('exams').update(examData).eq('id', examId);
            } else {
                // إنشاء جديد
                const { data: newExam, error: createError } = await supabase.from('exams').insert({
                    ...examData,
                    subject_id: subjectId,
                    sort_order: 999
                }).select().single();
                if (createError) throw createError;
                examId = newExam.id;
            }

            // 2. حذف الأسئلة المحذوفة
            if (deletedQuestionIds && deletedQuestionIds.length > 0) {
                await supabase.from('questions').delete().in('id', deletedQuestionIds);
            }

            // 3. معالجة الأسئلة (إضافة جديد أو تحديث موجود)
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                let questionId = q.id; // إذا كان السؤال له ID فهو موجود مسبقاً

                const questionData = {
                    exam_id: examId,
                    question_text: q.text,
                    image_file_id: q.image || null,
                    sort_order: i
                };

                if (questionId && !String(questionId).startsWith('temp')) {
                    // تحديث سؤال موجود
                    await supabase.from('questions').update(questionData).eq('id', questionId);
                    
                    // تحديث الاختيارات: الأسهل هو حذف القديم وإضافة الجديد لضمان الترتيب والمطابقة
                    await supabase.from('options').delete().eq('question_id', questionId);
                } else {
                    // إضافة سؤال جديد
                    const { data: newQ, error: qErr } = await supabase.from('questions').insert(questionData).select().single();
                    if (qErr) throw qErr;
                    questionId = newQ.id;
                }

                // إضافة الاختيارات
                const optionsData = q.options.map((optText, idx) => ({
                    question_id: questionId,
                    option_text: optText,
                    is_correct: idx === parseInt(q.correctIndex),
                    sort_order: idx
                }));
                await supabase.from('options').insert(optionsData);
            }

            return res.status(200).json({ success: true });
        }

        if (action === 'delete_item') {
            await supabase.from(payload.type).delete().eq('id', payload.id);
            return res.status(200).json({ success: true });
        }

      } catch (err) {
          console.error("Manage Content Error:", err);
          return res.status(500).json({ error: err.message });
      }
  }
};
