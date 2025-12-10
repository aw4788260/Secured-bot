import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  // 1. التحقق من الأدمن
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  // ---------------------------------------------------------
  // GET: جلب المحتوى بالكامل (لحل مشكلة اختفاء البيانات)
  // ---------------------------------------------------------
  if (req.method === 'GET') {
      try {
          // جلب الكورسات مع المواد
          const { data: courses, error } = await supabase
              .from('courses')
              .select(`
                  id, title, sort_order,
                  subjects (
                      id, title, sort_order,
                      chapters (
                          id, title, sort_order,
                          videos (id, title, sort_order, youtube_video_id),
                          pdfs (id, title, sort_order, file_path)
                      ),
                      exams (id, title, duration_minutes, sort_order)
                  )
              `)
              .order('sort_order', { ascending: true })
              .order('sort_order', { foreignTable: 'subjects', ascending: true })
              .order('sort_order', { foreignTable: 'subjects.chapters', ascending: true });

          if (error) throw error;
          
          return res.status(200).json(courses);
      } catch (err) {
          return res.status(500).json({ error: err.message });
      }
  }

  // ---------------------------------------------------------
  // POST: الإضافة والحذف
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      const { action, payload } = req.body;

      try {
        // إضافة شابتر
        if (action === 'add_chapter') {
            await supabase.from('chapters').insert({
                subject_id: payload.subjectId,
                title: payload.title,
                sort_order: 99
            });
            return res.status(200).json({ success: true });
        }

        // إضافة فيديو يوتيوب
        if (action === 'add_video') {
            const { title, url, chapterId } = payload;
            // استخراج ID اليوتيوب بدقة
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            const youtubeId = (match && match[2].length === 11) ? match[2] : null;

            if (!youtubeId) return res.status(400).json({ error: 'رابط يوتيوب غير صالح' });

            await supabase.from('videos').insert({
                title,
                chapter_id: chapterId,
                youtube_video_id: youtubeId,
                type: 'youtube',
                sort_order: 99
            });
            return res.status(200).json({ success: true });
        }

        // حفظ امتحان
        if (action === 'save_exam') {
            const { subjectId, title, duration, questions } = payload;
            
            const { data: exam, error: examErr } = await supabase.from('exams').insert({
                subject_id: subjectId,
                title,
                duration_minutes: parseInt(duration),
                sort_order: 99
            }).select().single();

            if (examErr) throw examErr;

            // إضافة الأسئلة
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const { data: newQ, error: qErr } = await supabase.from('questions').insert({
                    exam_id: exam.id,
                    question_text: q.text,
                    image_file_id: q.image || null,
                    sort_order: i
                }).select().single();

                if (qErr) throw qErr;

                // إضافة الاختيارات
                const optionsData = q.options.map((opt, idx) => ({
                    question_id: newQ.id,
                    option_text: opt.text,
                    is_correct: idx === parseInt(q.correctIndex),
                    sort_order: idx
                }));
                await supabase.from('options').insert(optionsData);
            }
            return res.status(200).json({ success: true });
        }

        // حذف عنصر
        if (action === 'delete_item') {
            const { type, id } = payload; // type: 'courses', 'subjects', 'chapters', 'videos', 'pdfs', 'exams'
            await supabase.from(type).delete().eq('id', id);
            return res.status(200).json({ success: true });
        }

      } catch (err) {
          return res.status(500).json({ error: err.message });
      }
  }
};
