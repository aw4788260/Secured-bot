import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { supabase } from '../../../../lib/supabaseClient';
import { getBunnyVideoStatus } from '../../../../lib/bunnyStream';

// ===================================================================
// 📊 الاستعلام عن حالة معالجة فيديو واحد فقط على Bunny Stream
// (بانتظار المعالجة / قيد المعالجة / جاهز)
// ✅ مصمم ليُستدعى عند الضغط على زر "تحقق من الحالة" لفيديو محدد فقط،
// وليس لجلب حالة كل الفيديوهات دفعة واحدة.
// ===================================================================
export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. ✅ التحقق من صلاحية المعلم/الأدمن
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
    return; // الرد تم إرساله بالفعل داخل الدالة المساعدة
  }

  const { videoId } = req.query;
  if (!videoId) {
    return res.status(400).json({ error: 'videoId مطلوب' });
  }

  try {
    // 2. جلب الفيديو من قاعدة البيانات للتحقق من الملكية ومعرفة bunny_video_id
    const { data: video, error: videoErr } = await supabase
      .from('videos')
      .select('id, bunny_video_id, chapters ( subjects ( courses ( teacher_id ) ) )')
      .eq('id', videoId)
      .single();

    if (videoErr || !video) {
      return res.status(404).json({ error: 'الفيديو غير موجود' });
    }

    // 3. ✅ التحقق من ملكية المعلم لهذا الفيديو (إلا إذا كان سوبر أدمن)
    if (user.role !== 'super_admin') {
      const courseTeacherId = video.chapters?.subjects?.courses?.teacher_id;
      if (!courseTeacherId || String(courseTeacherId) !== String(user.teacherId)) {
        return res.status(403).json({ error: 'غير مصرح لك بمشاهدة حالة هذا الفيديو.' });
      }
    }

    if (!video.bunny_video_id) {
      return res.status(400).json({ error: 'هذا الفيديو لا يحتوي على مصدر Bunny Stream (قد يكون رابط يوتيوب فقط).' });
    }

    // 4. الاستعلام عن الحالة من Bunny Stream (لهذا الفيديو فقط)
    const statusResult = await getBunnyVideoStatus(video.bunny_video_id);

    return res.status(200).json({
      success: true,
      ...statusResult,
    });
  } catch (err) {
    console.error('❌ [Video Status] Error:', err.message);
    return res.status(500).json({ error: 'فشل جلب حالة الفيديو من Bunny Stream' });
  }
};
