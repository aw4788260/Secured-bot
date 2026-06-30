import { verifyTeacher } from '../../../lib/teacherAuth';
import { supabase } from '../../../lib/supabaseClient';
import { getBunnyVideoStatus } from '../../../lib/bunnyStream';

// ===================================================================
// 📱 [APP] الاستعلام عن حالة معالجة فيديو واحد فقط على Bunny Stream
// (بانتظار المعالجة / قيد المعالجة / جاهز)
// نفس منطق /api/dashboard/teacher/video-status.js لكن بمصادقة التطبيق.
// ✅ يُحدّث حقل duration في قاعدة البيانات تلقائياً حين تنتهي المعالجة
// ===================================================================

function formatDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${mStr}:${sStr}`;
  return `${mStr}:${sStr}`;
}

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { videoId } = req.query;
  if (!videoId) {
    return res.status(400).json({ error: 'videoId مطلوب' });
  }

  try {
    // 2. جلب الفيديو من قاعدة البيانات للتحقق من الملكية ومعرفة bunny_video_id
    const { data: video, error: videoErr } = await supabase
      .from('videos')
      .select('id, bunny_video_id, duration, encoding_status, chapters ( subjects ( courses ( teacher_id ) ) )')
      .eq('id', videoId)
      .single();

    if (videoErr || !video) {
      return res.status(404).json({ error: 'الفيديو غير موجود' });
    }

    // 3. التحقق من ملكية المعلم لهذا الفيديو
    const courseTeacherId = video.chapters?.subjects?.courses?.teacher_id;
    if (!courseTeacherId || String(courseTeacherId) !== String(auth.teacherId)) {
      return res.status(403).json({ error: 'غير مصرح لك بمشاهدة حالة هذا الفيديو.' });
    }

    if (!video.bunny_video_id) {
      return res.status(400).json({ error: 'هذا الفيديو لا يحتوي على مصدر Bunny Stream (قد يكون رابط يوتيوب فقط).' });
    }

    // 4. الاستعلام عن الحالة من Bunny Stream (لهذا الفيديو فقط)
    const statusResult = await getBunnyVideoStatus(video.bunny_video_id);

    // ✅ إذا انتهت المعالجة وتوفرت المدة من Bunny، نحدّث قاعدة البيانات تلقائياً
    const currentDurationMissing = !video.duration || video.duration === '00:00';
    const bunnyHasDuration = statusResult.length && statusResult.length > 0;
    const encodingDone = statusResult.statusCode === 3 || statusResult.statusCode === 4;

    if (encodingDone && bunnyHasDuration && currentDurationMissing) {
      const formatted = formatDuration(statusResult.length);
      const { error: updateErr } = await supabase
        .from('videos')
        .update({ duration: formatted })
        .eq('id', videoId);

      if (!updateErr) {
        console.log(`✅ [teacher/video-status] Auto-updated duration for db_id=${videoId}: ${formatted}`);
        statusResult.durationUpdated = true;
        statusResult.duration = formatted;
      } else {
        console.error(`❌ [teacher/video-status] Failed to auto-update duration for db_id=${videoId}:`, updateErr);
      }
    }

    return res.status(200).json({
      success: true,
      encoding_status: video.encoding_status || 'encoding',
      ...statusResult,
    });
  } catch (err) {
    console.error('❌ [teacher/video-status] Error:', err.message);
    return res.status(500).json({ error: 'فشل جلب حالة الفيديو من Bunny Stream' });
  }
};
