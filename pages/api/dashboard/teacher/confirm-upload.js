import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { supabase } from '../../../../lib/supabaseClient';
import admin from '../../../../lib/firebaseAdmin';

// ===================================================================
// ✅ تأكيد اكتمال الرفع المباشر وحفظ الفيديو في قاعدة البيانات
// ===================================================================
// يُستدعى من العميل بعد أن يكتمل الرفع TUS مباشرة على Bunny
// يتحقق من صحة الفيديو على Bunny ثم يحفظ بياناته في جدول videos
//
// ملاحظة حول المدة (duration):
//   - المصدر الأول: durationSeconds القادمة من المتصفح (مستخرجة قبل الرفع)
//   - المصدر الاحتياطي: bunnyVideo.length (غالباً 0 مباشرة بعد الرفع)
//   - إذا بقيت 00:00، سيُحدّثها Bunny Webhook تلقائياً عند انتهاء التشفير
//     → راجع /api/webhooks/bunny-encoding.js
// ===================================================================

function getLibraryConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error('متغيرات البيئة الخاصة بـ Bunny Stream غير مكتملة');
  }
  return { libraryId, apiKey };
}

// دالة لتحويل الثواني إلى صيغة MM:SS أو HH:MM:SS لتتوافق مع قاعدة البيانات
function formatDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');

  if (h > 0) {
    const hStr = String(h).padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }
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
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const {
    bunnyVideoId,
    chapterId,
    title,
    notifyStudents = false,
    sortOrder = 999,
    durationSeconds = 0, // المدة المستخرجة من المتصفح محلياً (قد تكون 0 إذا فشل الاستخراج)
  } = req.body;

  if (!bunnyVideoId) {
    return res.status(400).json({ error: 'bunnyVideoId مطلوب' });
  }
  if (!chapterId) {
    return res.status(400).json({ error: 'chapterId مطلوب' });
  }

  // تنظيف: نضمن أن durationSeconds رقم حقيقي وموجب
  const clientDuration = Number(durationSeconds);
  const hasValidClientDuration = isFinite(clientDuration) && clientDuration > 0;

  // 2. التحقق من ملكية الفصل
  if (user.role !== 'super_admin') {
    const isOwner = await verifyChapterOwnership(chapterId, user.teacherId);
    if (!isOwner) {
      return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا الفصل.' });
    }
  }

  // 3. التحقق من وجود الفيديو فعلاً على Bunny (منع التزوير)
  const { libraryId, apiKey } = getLibraryConfig();
  const bunnyVideo = await verifyBunnyVideoExists(libraryId, apiKey, bunnyVideoId);

  if (!bunnyVideo) {
    return res.status(400).json({ error: 'لم يتم العثور على الفيديو في Bunny Stream. تأكد من اكتمال الرفع.' });
  }

  // 4. التحقق من أن الفيديو ليس بحالة فشل
  // status: 5 = Failed, 8 = PresignedUploadFailed
  if (bunnyVideo.status === 5 || bunnyVideo.status === 8) {
    return res.status(400).json({ error: 'فشل رفع الفيديو على Bunny Stream. يرجى المحاولة مرة أخرى.' });
  }

  const videoTitle = title || bunnyVideo.title || 'Untitled Video';

  // ✅ ترتيب الأولوية لتحديد المدة:
  //   1. المدة القادمة من المتصفح (أدق مصدر — مستخرجة قبل الرفع)
  //   2. المدة القادمة من Bunny (قد تكون 0 مباشرة بعد الرفع لأن المعالجة لم تبدأ بعد)
  //   3. '00:00' مؤقتاً — سيُحدّثها Bunny Webhook عند انتهاء التشفير تلقائياً
  const bunnyLength = Number(bunnyVideo.length) || 0;
  const finalDurationSecs = hasValidClientDuration ? clientDuration : bunnyLength;
  const formattedDuration = formatDuration(finalDurationSecs);

  const durationPending = finalDurationSecs <= 0;
  if (durationPending) {
    console.warn(`⚠️ [confirm-upload] No duration yet for bunny_id=${bunnyVideoId} — Bunny Webhook will update it after encoding`);
  }

  // 5. حفظ الفيديو في قاعدة البيانات
  const { data: insertedVideo, error: dbError } = await supabase
    .from('videos')
    .insert({
      chapter_id: chapterId,
      title: videoTitle,
      bunny_video_id: bunnyVideoId,
      sort_order: sortOrder,
      duration: formattedDuration,
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('❌ [confirm-upload] DB Insert Error:', dbError);
    return res.status(500).json({ error: 'فشل حفظ بيانات الفيديو في قاعدة البيانات' });
  }

  // 6. إرسال إشعار للطلاب (اختياري)
  if (notifyStudents) {
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
      // فشل الإشعار لا يوقف العملية — الفيديو حُفظ بنجاح
      console.error('⚠️ [confirm-upload] Notification error:', notifyErr.message);
    }
  }

  console.log(`✅ [confirm-upload] Video saved. db_id=${insertedVideo.id}, bunny_id=${bunnyVideoId}, duration=${formattedDuration}`);

  return res.status(200).json({
    success: true,
    videoId: insertedVideo.id,
    bunnyVideoId,
    title: videoTitle,
    duration: formattedDuration,
    durationPending, // إشارة للواجهة أن المدة ستُحدَّث تلقائياً عبر Bunny Webhook
  });
}
