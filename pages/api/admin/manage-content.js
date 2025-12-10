import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { action, payload } = req.body;

  try {
    // --- إضافة فيديو يوتيوب ---
    if (action === 'add_video') {
        const { title, url, chapterId } = payload;
        // استخراج ID اليوتيوب
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const youtubeId = (match && match[2].length === 11) ? match[2] : null;

        if (!youtubeId) return res.status(400).json({ error: 'رابط يوتيوب غير صالح' });

        const { error } = await supabase.from('videos').insert({
            title,
            chapter_id: chapterId,
            youtube_video_id: youtubeId,
            type: 'youtube',
            sort_order: 0
        });
        if (error) throw error;
        return res.status(200).json({ success: true });
    }

    // --- حفظ امتحان كامل (مع الأسئلة) ---
    if (action === 'save_exam') {
        const { subjectId, title, duration, questions } = payload; // questions array includes options & image path

        // 1. إنشاء الامتحان
        const { data: exam, error: examErr } = await supabase.from('exams').insert({
            subject_id: subjectId,
            title,
            duration_minutes: parseInt(duration),
            sort_order: 0
        }).select().single();

        if (examErr) throw examErr;

        // 2. إضافة الأسئلة
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const { data: newQ, error: qErr } = await supabase.from('questions').insert({
                exam_id: exam.id,
                question_text: q.text,
                image_file_id: q.image || null, // اسم الصورة المحفوظة في السيرفر
                sort_order: i
            }).select().single();

            if (qErr) throw qErr;

            // 3. إضافة الاختيارات
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

    // --- حذف عنصر ---
    if (action === 'delete_item') {
        const { type, id } = payload; // type: 'videos', 'pdfs', 'exams'
        const { error } = await supabase.from(type).delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
    }

  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
