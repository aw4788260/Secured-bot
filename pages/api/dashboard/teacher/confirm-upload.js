import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { supabase } from '../../../../lib/supabaseClient';
import admin from '../../../../lib/firebaseAdmin';

// ===================================================================
// ✅ تأكيد اكتمال الرفع المباشر وحفظ الفيديو في قاعدة البيانات
// ===================================================================
// يُستدعى من العميل بعد أن يكتمل الرفع TUS مباشرة على Bunny
// يتحقق من صحة الفيديو على Bunny ثم يحفظ بياناته في جدول videos
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

/**
 * ✅ يستطلع Bunny بصبر حتى تنتهي المعالجة ويظهر الـ length، ثم يحدّث قاعدة البيانات.
 * يعمل في الخلفية بعد إرسال الرد للعميل (لا ينتظره المعلم).
 *
 * المنطق:
 *  - يحاول كل 30 ثانية لمدة أقصاها 30 دقيقة (60 محاولة)
 *  - يتوقف حين يحصل على length > 0 أو حين تنتهي المهلة أو تفشل المعالجة
 */
async function scheduleDurationBackfill(dbVideoId, bunnyVideoId, libraryId, apiKey) {
  const MAX_ATTEMPTS = 60;       // 60 × 30 ثانية = 30 دقيقة
  const POLL_INTERVAL_MS = 30000; // 30 ثانية

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log(`🕐 [duration-backfill] Starting poll for db_id=${dbVideoId}, bunny_id=${bunnyVideoId}`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await delay(POLL_INTERVAL_MS);

    try {
      const res = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
        { headers: { AccessKey: apiKey, accept: 'application/json' } }
      );

      if (!res.ok) {
        console.warn(`⚠️ [duration-backfill] Bunny fetch failed (attempt ${attempt}), status=${res.status}`);
        continue;
      }

      const bunnyData = await res.json();

      // توقف فوري عند فشل المعالجة
      if (bunnyData.status === 5 || bunnyData.status === 8) {
        console.error(`❌ [duration-backfill] Bunny encoding failed for bunny_id=${bunnyVideoId}`);
        return;
      }

      const length = bunnyData.length; // بالثواني

      if (length && length > 0) {
        const formatted = formatDuration(length);
        const { error: updateErr } = await supabase
          .from('videos')
          .update({ duration: formatted })
          .eq('id', dbVideoId);

        if (updateErr) {
          console.error(`❌ [duration-backfill] DB update failed for db_id=${dbVideoId}:`, updateErr);
        } else {
          console.log(`✅ [duration-backfill] Duration updated: db_id=${dbVideoId}, duration=${formatted} (from Bunny after encoding)`);
        }
        return; // تم الهدف — أوقف الـ polling
      }

      console.log(`🔄 [duration-backfill] Attempt ${attempt}/${MAX_ATTEMPTS}: Bunny length still 0 (status=${bunnyData.status})`);
    } catch (err) {
      console.error(`❌ [duration-backfill] Error on attempt ${attempt}:`, err.message);
    }
  }

  console.warn(`⏱️ [duration-backfill] Gave up after ${MAX_ATTEMPTS} attempts for db_id=${dbVideoId}`);
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
    durationSeconds = 0, // 👈 المدة المستخرجة من المتصفح محلياً (قد تكون 0 إذا فشل الاستخراج)
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
  //   3. '00:00' مؤقتاً ريثما يتم التحديث عبر الـ backfill
  const bunnyLength = Number(bunnyVideo.length) || 0;
  const finalDurationSecs = hasValidClientDuration ? clientDuration : bunnyLength;
  const formattedDuration = formatDuration(finalDurationSecs);

  // هل نحتاج إلى backfill لاحق؟ (عندما تكون كل المصادر أعطت 0)
  const needsBackfill = finalDurationSecs <= 0;

  if (needsBackfill) {
    console.warn(`⚠️ [confirm-upload] No duration available yet for bunny_id=${bunnyVideoId} — will poll Bunny after encoding`);
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

  // ✅ إرسال الرد للعميل أولاً (لا ننتظر backfill)
  res.status(200).json({
    success: true,
    videoId: insertedVideo.id,
    bunnyVideoId,
    title: videoTitle,
    duration: formattedDuration,
    durationPending: needsBackfill, // إشارة للعميل أن المدة ستُحدَّث لاحقاً
  });

  // ✅ ثم نبدأ backfill في الخلفية إذا لم تتوفر المدة
  // (لا await هنا — يعمل بعد انتهاء الـ request)
  if (needsBackfill) {
    scheduleDurationBackfill(insertedVideo.id, bunnyVideoId, libraryId, apiKey).catch((err) => {
      console.error('❌ [duration-backfill] Unhandled error:', err.message);
    });
  }
}
