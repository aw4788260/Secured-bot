// pages/api/webhooks/bunny-encoding.js
// ===================================================================
// 🔔 Webhook من Bunny Stream — يُستدعى تلقائياً عند كل تغيير في حالة الفيديو
// ===================================================================
//
// الإعداد في لوحة Bunny (مرة واحدة فقط):
//   Stream → Library Settings → Webhook URL → الصق:
//   https://yourdomain.com/api/webhooks/bunny-encoding
//   ثم احفظ — لا يوجد خيار لتصفية الأحداث، Bunny يرسل كل الحالات
//
// الـ Payload الذي يرسله Bunny (3 حقول فقط — لا يوجد VideoLength):
//   {
//     "VideoLibraryId": 133,
//     "VideoGuid": "657bb740-...",  ← نفس bunny_video_id في DB
//     "Status": 1                    ← انظر جدول الحالات أدناه
//   }
//
// جدول حالات Bunny Status:
//   0 = Created          (تم إنشاء كائن الفيديو)
//   1 = Processing       (بدأت المعالجة / التشفير فعلياً)  ← نحدّث DB → 'encoding'
//   2 = Transcoding      (جزء من المعالجة)
//   3 = Finished         (اكتملت المعالجة بالكامل)         ← نحدّث DB → 'ready'
//   4 = ResolutionFinished (دقة واحدة اكتملت — قد يُرسل عدة مرات)  ← نحدّث DB → 'ready'
//   5 = Failed           (فشل)
//   6 = PresignedUploadStarted
//   7 = PresignedUploadFinished
//   8 = PresignedUploadFailed
//
// دورة حياة encoding_status في DB:
//   'waiting'  → بعد اكتمال رفع TUS (confirm-upload.js)
//   'encoding' → عند Status=1 Processing  (هنا)
//   'ready'    → عند Status=3 أو 4 Finished (هنا)
//
// 🔔 إشعار الطلاب (notify_students):
//   إذا فعّل المعلم "إشعار الطلاب" عند إضافة فيديو Bunny، لا يُرسل الإشعار فوراً
//   (لأن الفيديو غير قابل للمشاهدة بعد). بدلاً من ذلك يُخزَّن علَم notify_students=true
//   على صف الفيديو (من confirm-upload.js أو content.js)، ثم هذا الملف هو من يرسل
//   الإشعار الفعلي بمجرد وصول Status=3/4 (Finished) — أي بعد اكتمال التشفير حقاً.
//
// الأمان (اختياري):
//   Bunny يُرفق التوقيع في هذه الترويسات:
//     X-BunnyStream-Signature          ← HMAC-SHA256 hex
//     X-BunnyStream-Signature-Version ← "v1"
//     X-BunnyStream-Signature-Algorithm ← "hmac-sha256"
//   المفتاح هو Library's Read-Only API key
//   احفظه في .env كـ BUNNY_WEBHOOK_SECRET (اختياري — إذا غاب نقبل بدون تحقق)
// ===================================================================

import { supabase } from '../../../lib/supabaseClient';
import admin from '../../../lib/firebaseAdmin'; // ✅ لإرسال إشعار الطلاب بمجرد اكتمال التشفير فعلياً
import crypto from 'crypto';

// ✅ تعطيل bodyParser حتى نقرأ الجسم الخام للتحقق من التوقيع
export const config = {
  api: { bodyParser: false },
};

// قراءة الجسم الخام كـ Buffer
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// تحويل الثواني → MM:SS أو HH:MM:SS
function formatDuration(totalSeconds) {
  const secs = Math.floor(Number(totalSeconds) || 0);
  if (secs <= 0) return '00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

// التحقق من توقيع Bunny (v1 / HMAC-SHA256)
function verifySignature(rawBody, headers, secret) {
  const version   = headers['x-bunnystream-signature-version'];
  const algorithm = headers['x-bunnystream-signature-algorithm'];
  const signature = headers['x-bunnystream-signature'];

  if (!signature || version !== 'v1' || algorithm !== 'hmac-sha256') return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody) // Buffer مباشرة — لا toString
    .digest('hex');

  // مقارنة ثابتة الوقت لمنع timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

export default async function handler(req, res) {
  // ── 1. POST فقط ────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── 2. قراءة الجسم الخام ──────────────────────────────────────
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('❌ [bunny-webhook] Body read error:', err.message);
    return res.status(400).json({ error: 'Failed to read body' });
  }

  // ── 3. التحقق من التوقيع (إذا كان المفتاح موجوداً في .env) ───
  const webhookSecret = process.env.BUNNY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const valid = verifySignature(rawBody, req.headers, webhookSecret);
    if (!valid) {
      console.error('❌ [bunny-webhook] Invalid signature — rejected');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  // إذا لم يكن BUNNY_WEBHOOK_SECRET محدداً نقبل الطلب بدون تحقق
  // (مناسب للبداية — أضف المفتاح لاحقاً لمزيد من الأمان)

  // ── 4. تحليل الـ payload ──────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { VideoGuid: bunnyVideoId, Status: statusCode, VideoLibraryId: payloadLibraryId } = payload;

  console.log(`📨 [bunny-webhook] status=${statusCode}, bunny_id=${bunnyVideoId}`);

  // ── 5. تجاهل أحداث المكتبات الأخرى ──────────────────────────
  const ourLibraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  if (ourLibraryId && payloadLibraryId && String(payloadLibraryId) !== String(ourLibraryId)) {
    return res.status(200).json({ ignored: true, reason: 'wrong library' });
  }

  // ── 6. تصنيف الحدث حسب Status ────────────────────────────────
  //
  // Status=1  Processing  → نُحدّث DB إلى 'encoding' (بدأت المعالجة فعلياً)
  // Status=3  Finished    → نُحدّث DB إلى 'ready'    (اكتملت المعالجة بالكامل)
  // Status=4  ResolutionFinished → نُحدّث DB إلى 'ready' (تُرسَل لكل دقة تنتهي)
  // بقية الحالات (0,2,5,6,7,8) → نتجاهلها ونُعيد 200

  const isProcessingEvent = statusCode === 1;
  const isFinishedEvent   = statusCode === 3 || statusCode === 4;

  if (!isProcessingEvent && !isFinishedEvent) {
    return res.status(200).json({ ignored: true, reason: `status ${statusCode} not handled` });
  }

  if (!bunnyVideoId) {
    return res.status(400).json({ error: 'Missing VideoGuid' });
  }

  // ── 7. جلب الفيديو من DB بواسطة bunny_video_id ───────────────
  // ✅ نجلب أيضاً title, chapter_id, notify_students حتى نتمكن من إرسال
  // إشعار "تم رفع فيديو" للطلاب بمجرد اكتمال التشفير فعلياً (وليس عند الإضافة)
  const { data: video, error: fetchErr } = await supabase
    .from('videos')
    .select('id, title, chapter_id, duration, encoding_status, notify_students')
    .eq('bunny_video_id', bunnyVideoId)
    .single();

  if (fetchErr || !video) {
    // محذوف أو من مكتبة أخرى — نُعيد 200 لمنع Bunny من إعادة المحاولة
    console.warn(`⚠️ [bunny-webhook] Video not found in DB: bunny_id=${bunnyVideoId}`);
    return res.status(200).json({ ignored: true, reason: 'not in DB' });
  }

  // ── 8. حالة Processing (Status=1) → encoding ─────────────────
  if (isProcessingEvent) {
    // لا نتراجع إلى 'encoding' إذا وصل الـ ready مسبقاً (race condition نادر)
    if (video.encoding_status === 'ready') {
      console.log(`ℹ️ [bunny-webhook] Already ready, ignoring processing event for bunny_id=${bunnyVideoId}`);
      return res.status(200).json({ ignored: true, reason: 'already ready' });
    }

    const { error: encErr } = await supabase
      .from('videos')
      .update({ encoding_status: 'encoding' })
      .eq('id', video.id);

    if (encErr) {
      console.error(`❌ [bunny-webhook] DB encoding update failed for db_id=${video.id}:`, encErr);
      return res.status(500).json({ error: 'DB update failed' });
    }

    console.log(`🔄 [bunny-webhook] Encoding started: db_id=${video.id}, bunny_id=${bunnyVideoId}, status: ${video.encoding_status} → encoding`);
    return res.status(200).json({ success: true, videoId: video.id, bunnyVideoId, encoding_status: 'encoding' });
  }

  // ── 9. حالة Finished (Status=3 أو 4) → ready ─────────────────
  // نجلب الـ length من Bunny API (الـ payload لا يحتوي عليها)
  const apiKey    = process.env.BUNNY_STREAM_API_KEY;
  const libraryId = ourLibraryId;
  let durationSeconds = 0;

  try {
    const apiRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
      { headers: { AccessKey: apiKey, accept: 'application/json' } }
    );
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      durationSeconds = Number(apiData.length) || 0;
      console.log(`📏 [bunny-webhook] Bunny API length=${durationSeconds}s for bunny_id=${bunnyVideoId}`);
    } else {
      console.error(`❌ [bunny-webhook] Bunny API returned ${apiRes.status}`);
    }
  } catch (apiErr) {
    console.error('❌ [bunny-webhook] Bunny API fetch failed:', apiErr.message);
  }

  if (durationSeconds <= 0) {
    // Bunny أخبرنا بالاكتمال لكن length لا تزال 0 — نادر جداً
    // نُعيد 500 حتى يُعيد Bunny المحاولة بعد قليل
    console.warn(`⚠️ [bunny-webhook] length=0 despite status=${statusCode} for bunny_id=${bunnyVideoId}`);
    return res.status(500).json({ error: 'duration unavailable yet, will retry' });
  }

  // ── 10. تحديث DB: encoding_status → 'ready' + المدة إن كانت ناقصة ──
  const formatted = formatDuration(durationSeconds);
  const currentDuration = video.duration || '00:00';
  const currentEncodingStatus = video.encoding_status;

  const updatePayload = { encoding_status: 'ready' };
  if (currentDuration === '00:00') {
    updatePayload.duration = formatted;
  }

  const { error: updateErr } = await supabase
    .from('videos')
    .update(updatePayload)
    .eq('id', video.id);

  if (updateErr) {
    console.error(`❌ [bunny-webhook] DB update failed for db_id=${video.id}:`, updateErr);
    // نُعيد 500 حتى يُعيد Bunny المحاولة
    return res.status(500).json({ error: 'DB update failed' });
  }

  console.log(`✅ [bunny-webhook] Video ready: db_id=${video.id}, bunny_id=${bunnyVideoId}, encoding_status: ${currentEncodingStatus} → ready, duration=${updatePayload.duration || currentDuration}`);

  // ── 11. 🔔 إرسال الإشعار المؤجَّل للطلاب (إن كان المعلم قد فعّله عند الإضافة) ──
  // هذا هو المكان الصحيح لإرسال إشعار "تم رفع فيديو": الآن فقط أصبح الفيديو
  // جاهزاً فعلياً للمشاهدة، وليس لحظة ضغط المعلم على "إضافة".
  //
  // Status=3 و 4 قد يصلان للفيديو نفسه (أو عدة أحداث 4 لكل دقة عرض)، لذا نستخدم
  // تحديثاً شرطياً (eq('notify_students', true)) كـ"قفل" ذري: فقط أول طلب يصل
  // فعلياً يُحدّث notify_students إلى false وينجح بإرسال الإشعار، أي طلب لاحق
  // لن يجد notify_students=true فيتجاهل الإرسال — فلا يتكرر الإشعار.
  if (video.notify_students) {
    try {
      const { data: claimed } = await supabase
        .from('videos')
        .update({ notify_students: false })
        .eq('id', video.id)
        .eq('notify_students', true)
        .select('id')
        .maybeSingle();

      if (claimed) {
        const { data: chapterInfo } = await supabase
          .from('chapters')
          .select('subject_id, subjects!inner(courses!inner(title))')
          .eq('id', video.chapter_id)
          .single();

        const subjectId = chapterInfo?.subject_id;
        if (subjectId) {
          const courseTitle = chapterInfo.subjects?.courses?.title || 'تحديث جديد في الكورس';
          const videoTitle = video.title || 'فيديو جديد';

          const message = {
            notification: { title: courseTitle, body: `تم رفع فيديو: ${videoTitle}` },
            topic: `subject_${subjectId}`,
            android: { priority: 'high', notification: { sound: 'default' } },
            apns: { payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } } },
            data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: 'subject', id: subjectId.toString() },
          };

          await admin.messaging().send(message);

          await supabase.from('notifications').insert({
            title: courseTitle,
            body: `تم رفع فيديو: ${videoTitle}`,
            target_type: 'subject',
            target_id: subjectId.toString(),
            sender_role: 'teacher',
          });

          console.log(`🔔 [bunny-webhook] Deferred notification sent: db_id=${video.id}, subject_id=${subjectId}`);
        } else {
          console.warn(`⚠️ [bunny-webhook] Could not resolve subject for db_id=${video.id} — notification skipped`);
        }
      } else {
        console.log(`ℹ️ [bunny-webhook] Notification already claimed/sent by another event for db_id=${video.id}`);
      }
    } catch (notifyErr) {
      console.error(`⚠️ [bunny-webhook] Deferred notification error for db_id=${video.id}:`, notifyErr.message);
      // فشل الإشعار لا يجب أن يفشّل الـ webhook — الفيديو أصبح 'ready' بنجاح فعلاً
    }
  }

  return res.status(200).json({
    success: true,
    videoId: video.id,
    bunnyVideoId,
    encoding_status: 'ready',
    duration: updatePayload.duration || currentDuration,
    updated: true,
  });
}
