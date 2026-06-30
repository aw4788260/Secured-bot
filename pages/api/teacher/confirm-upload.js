import { verifyTeacher } from '../../../lib/teacherAuth';
import { supabase } from '../../../lib/supabaseClient';
import admin from '../../../lib/firebaseAdmin';

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

async function verifyBunnyVideoExists(libraryId, apiKey, bunnyVideoId) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
    { headers: { AccessKey: apiKey, accept: 'application/json' } }
  );
  if (!res.ok) return null;
  return res.json();
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
    sortOrder = 999,
    durationSeconds = 0, // المدة المستخرجة محلياً على الجهاز (قد تكون 0 إذا فشل الاستخراج)
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
  const { data: insertedVideo, error: dbError } = await supabase
    .from('videos')
    .insert({
      chapter_id: chapterId,
      title: videoTitle,
      bunny_video_id: bunnyVideoId,
      sort_order: sortOrder,
      duration: formattedDuration,
      encoding_status: 'waiting',
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('❌ [teacher/confirm-upload] DB Insert Error:', dbError);
    return res.status(500).json({ error: 'فشل حفظ بيانات الفيديو في قاعدة البيانات' });
  }

  // 6. إرسال إشعار للطلاب (اختياري)
  if (notifyStudents === true || notifyStudents === 'true') {
    try {
      const { data: chapterInfo } = await supabase
        .from('chapters')
        .select('subject_id, subjects(courses(title))')
        .eq('id', chapterId)
        .single();

      if (chapterInfo?.subject_id) {
        const courseTitle = chapterInfo.subjects?.courses?.title || 'تحديث جديد في الكورس';
        const subjectId = chapterInfo.subject_id;

        const message = {
          notification: { title: courseTitle, body: `تم رفع فيديو: ${videoTitle}` },
          topic: `subject_${subjectId}`,
          android: { priority: 'high', notification: { sound: 'default' } },
          apns: { payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } } },
          data: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            type: 'subject',
            id: subjectId.toString(),
          },
        };

        await admin.messaging().send(message);

        await supabase.from('notifications').insert({
          title: courseTitle,
          body: `تم رفع فيديو: ${videoTitle}`,
          target_type: 'subject',
          target_id: subjectId.toString(),
          sender_role: 'teacher',
        });
      }
    } catch (notifyErr) {
      console.error('⚠️ [teacher/confirm-upload] Notification error:', notifyErr.message);
    }
  }

  console.log(`✅ [teacher/confirm-upload] Video saved. db_id=${insertedVideo.id}, bunny_id=${bunnyVideoId}, duration=${formattedDuration}, status=waiting`);

  return res.status(200).json({
    success: true,
    videoId: insertedVideo.id,
    bunnyVideoId,
    title: videoTitle,
    duration: formattedDuration,
    encoding_status: 'waiting',
    durationPending,
  });
}
