import { verifyTeacher } from '../../../lib/teacherAuth';
import { supabase } from '../../../lib/supabaseClient';
// ملاحظة: لم نعد نحتاج firebaseAdmin هنا — الإشعار يُرسل من webhooks/bunny-encoding.js بعد اكتمال التشفير

// ===================================================================
// 📱 [APP] تأكيد اكتمال الرفع المباشر (TUS) وحفظ الفيديو في قاعدة البيانات
// ===================================================================
// نفس منطق /api/dashboard/teacher/confirm-upload.js الخاص بالويب، لكنه
// يستخدم verifyTeacher (مصادقة Bearer Token) بدلاً من جلسة الكوكيز.
//
// يُستدعى من التطبيق بعد أن يكتمل الرفع TUS مباشرة على Bunny.
// يتحقق من صحة الفيديو على Bunny ثم يحفظ بياناته في جدول videos.
//
// دورة حياة encoding_status (محدّثة تلقائياً بواسطة /api/webhooks/bunny-encoding.js):
//   'waiting'  → الرفع TUS اكتمل، الفيديو وصل Bunny لكن المعالجة لم تبدأ بعد
//   'encoding' → Bunny بدأ المعالجة فعلياً (Webhook Status=1)
//   'ready'    → اكتملت المعالجة وصار الفيديو متاحاً (Webhook Status=3/4)
// ===================================================================

function getLibraryConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error('متغيرات البيئة الخاصة بـ Bunny Stream غير مكتملة');
  }
  return { libraryId, apiKey };
}

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

async function verifyChapterOwnership(chapterId, teacherId) {
  if (!chapterId) return false;
  const { data: chapter } = await supabase
    .from('chapters')
    .select('subjects ( courses ( teacher_id ) )')
    .eq('id', chapterId)
    .single();

  const courseTeacherId = chapter?.subjects?.courses?.teacher_id;
  return courseTeacherId && String(courseTeacherId) === String(teacherId);
}

// ✅ يتحقق أن الفيديو المُراد استبداله موجود فعلاً ويملكه نفس المعلم،
// ويرجع بيانات الفيديو القديم (وعلى رأسها bunny_video_id القديم) لتنظيفه لاحقاً
async function verifyVideoOwnership(videoId, teacherId) {
  if (!videoId) return null;
  const { data: video } = await supabase
    .from('videos')
    .select('id, bunny_video_id, chapters ( subjects ( courses ( teacher_id ) ) )')
    .eq('id', videoId)
    .single();

  const courseTeacherId = video?.chapters?.subjects?.courses?.teacher_id;
  if (!video || !courseTeacherId || String(courseTeacherId) !== String(teacherId)) {
    return null;
  }
  return video;
}

async function deleteVideoFromBunny(libraryId, apiKey, bunnyVideoId) {
  if (!bunnyVideoId) return;
  try {
    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey, accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`⚠️ [teacher/confirm-upload] Failed to delete old Bunny video ${bunnyVideoId}, status: ${res.status}`);
    } else {
      console.log(`✅ [teacher/confirm-upload] Old Bunny video ${bunnyVideoId} deleted after replacement.`);
    }
  } catch (err) {
    console.error('⚠️ [teacher/confirm-upload] Error deleting old Bunny video:', err.message);
  }
}

async function verifyBunnyVideoExists(libraryId, apiKey, bunnyVideoId) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
    { headers: { AccessKey: apiKey, accept: 'application/json' } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ============================================================
// 🔢 دالة مساعدة: جلب قيمة sort_order التالية للفيديو الجديد
// ============================================================
async function getNextVideoSortOrder(chapterId) {
  try {
    const { data: rows } = await supabase
      .from('videos')
      .select('sort_order')
      .eq('chapter_id', chapterId);

    if (!rows || rows.length === 0) return 0;
    const maxOrder = Math.max(...rows.map(r => r.sort_order ?? 0));
    return maxOrder + 1;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. التحقق من صلاحية المعلم
  const auth = await verifyTeacher(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const {
    bunnyVideoId,
    chapterId,
    title,
    notifyStudents = false,
    sortOrder = null, // إذا لم يُرسل، يُحسب تلقائياً من قاعدة البيانات
    durationSeconds = 0, // المدة المستخرجة محلياً على الجهاز (قد تكون 0 إذا فشل الاستخراج)
    replaceVideoId = null, // ✅ إذا أُرسل: نحدّث صف فيديو موجود بدلاً من إنشاء صف جديد
                            // (يُستخدم عند "استبدال" ملف فيديو مرفوع مسبقاً أثناء التعديل)
  } = req.body || {};

  if (!bunnyVideoId) {
    return res.status(400).json({ error: 'bunnyVideoId مطلوب' });
  }
  if (!chapterId) {
    return res.status(400).json({ error: 'chapterId مطلوب' });
  }

  const clientDuration = Number(durationSeconds);
  const hasValidClientDuration = isFinite(clientDuration) && clientDuration > 0;

  // 2. التحقق من ملكية الفصل
  const isOwner = await verifyChapterOwnership(chapterId, auth.teacherId);
  if (!isOwner) {
    return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا الفصل.' });
  }

  // 2.b إذا كان هذا "استبدالاً" لفيديو موجود (تعديل): تحقق من ملكية الفيديو
  // القديم نفسه قبل أي تعديل، ولا نسمح بالاستمرار إن لم يكن مملوكاً لنفس المعلم
  let oldVideo = null;
  if (replaceVideoId) {
    oldVideo = await verifyVideoOwnership(replaceVideoId, auth.teacherId);
    if (!oldVideo) {
      return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الفيديو.' });
    }
  }

  // 3. التحقق من وجود الفيديو فعلاً على Bunny (منع التزوير)
  const { libraryId, apiKey } = getLibraryConfig();
  const bunnyVideo = await verifyBunnyVideoExists(libraryId, apiKey, bunnyVideoId);

  if (!bunnyVideo) {
    return res.status(400).json({ error: 'لم يتم العثور على الفيديو في السيرفر. تأكد من اكتمال الرفع.' });
  }

  // 4. التحقق من أن الفيديو ليس بحالة فشل (status: 5 = Failed, 8 = PresignedUploadFailed)
  if (bunnyVideo.status === 5 || bunnyVideo.status === 8) {
    return res.status(400).json({ error: 'فشل رفع الفيديو على السيرفر. يرجى المحاولة مرة أخرى.' });
  }

  const videoTitle = title || bunnyVideo.title || 'Untitled Video';

  const bunnyLength = Number(bunnyVideo.length) || 0;
  const finalDurationSecs = hasValidClientDuration ? clientDuration : bunnyLength;
  const formattedDuration = formatDuration(finalDurationSecs);

  const durationPending = finalDurationSecs <= 0;
  if (durationPending) {
    console.warn(`⚠️ [teacher/confirm-upload] No duration yet for bunny_id=${bunnyVideoId} — Bunny Webhook will update it after encoding`);
  }

  // 5. حفظ الفيديو في قاعدة البيانات بحالة encoding_status = 'waiting'
  //    - فيديو جديد: إدراج صف جديد
  //    - استبدال (تعديل): تحديث نفس الصف القديم بالـ bunny_video_id الجديد
  //      حتى يبقى نفس معرف الفيديو في قاعدة البيانات (لا يتغير id الذي
  //      يستخدمه الطلاب بالفعل لمشاهدته) ثم حذف الفيديو القديم من Bunny
  let savedVideoId;
  let dbError;

  // ✅ الإشعار لا يُرسل الآن — يُخزَّن كعلَم (notify_students) على صف الفيديو نفسه
  // وسيُرسَل تلقائياً بواسطة /api/webhooks/bunny-encoding.js بمجرد اكتمال التشفير
  // (Status=3/4 → encoding_status='ready'). هذا يمنع وصول إشعار "تم رفع فيديو"
  // للطلاب بينما الفيديو لا يزال قيد المعالجة ولا يمكن تشغيله فعلياً.
  const wantsNotify = !replaceVideoId && (notifyStudents === true || notifyStudents === 'true');

  if (replaceVideoId && oldVideo) {
    const { error } = await supabase
      .from('videos')
      .update({
        title: videoTitle,
        bunny_video_id: bunnyVideoId,
        youtube_video_id: null, // ✅ كان قد يكون يوتيوب سابقاً — الآن أصبح Bunny فقط
        duration: formattedDuration,
        encoding_status: 'waiting',
        notify_students: false, // استبدال ملف موجود ليس محتوى جديداً — لا إشعار إطلاقاً
      })
      .eq('id', replaceVideoId);
    dbError = error;
    savedVideoId = replaceVideoId;
  } else {
    // ✅ تحديد ترتيب الفيديو: إذا أُرسل من التطبيق نستخدمه، وإلا نحسبه تلقائياً
    const finalSortOrder = (sortOrder !== null && sortOrder !== undefined)
      ? sortOrder
      : await getNextVideoSortOrder(chapterId);

    const { data: insertedVideo, error } = await supabase
      .from('videos')
      .insert({
        chapter_id: chapterId,
        title: videoTitle,
        bunny_video_id: bunnyVideoId,
        sort_order: finalSortOrder,
        duration: formattedDuration,
        encoding_status: 'waiting',
        notify_students: wantsNotify, // 🔔 يُستهلك لاحقاً بواسطة الـ webhook عند الجاهزية
      })
      .select('id')
      .single();
    dbError = error;
    savedVideoId = insertedVideo?.id;
  }

  if (dbError) {
    console.error('❌ [teacher/confirm-upload] DB Save Error:', dbError);
    return res.status(500).json({ error: 'فشل حفظ بيانات الفيديو في قاعدة البيانات' });
  }

  // ✅ بعد نجاح الاستبدال: احذف ملف الفيديو القديم من Bunny حتى لا يبقى يتيماً
  // (لا ننتظر النتيجة حتى لا نؤخر الرد على التطبيق)
  if (replaceVideoId && oldVideo?.bunny_video_id && oldVideo.bunny_video_id !== bunnyVideoId) {
    deleteVideoFromBunny(libraryId, apiKey, oldVideo.bunny_video_id);
  }

  // 6. ✅ لم يعد الإشعار يُرسل هنا. تم تخزينه كعلَم notify_students على صف
  // الفيديو أعلاه، وسيُرسله /api/webhooks/bunny-encoding.js تلقائياً بمجرد
  // أن يُصبح الفيديو 'ready' فعلياً (اكتمل التشفير على Bunny).
  if (wantsNotify) {
    console.log(`🔔 [teacher/confirm-upload] Notification deferred until encoding is ready. db_id=${savedVideoId}, bunny_id=${bunnyVideoId}`);
  }

  console.log(`✅ [teacher/confirm-upload] Video saved. db_id=${savedVideoId}, bunny_id=${bunnyVideoId}, duration=${formattedDuration}, status=waiting, replaced=${!!replaceVideoId}`);

  return res.status(200).json({
    success: true,
    videoId: savedVideoId,
    bunnyVideoId,
    title: videoTitle,
    duration: formattedDuration,
    encoding_status: 'waiting',
    durationPending,
    replaced: !!replaceVideoId,
  });
}
