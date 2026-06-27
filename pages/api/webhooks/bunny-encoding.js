// pages/api/webhooks/bunny-encoding.js
// ===================================================================
// 🔔 Webhook من Bunny Stream — يُستدعى تلقائياً حين تنتهي معالجة فيديو
// ===================================================================
//
// الإعداد المطلوب مرة واحدة في لوحة Bunny:
//   Stream → Library → Webhooks → أضف:
//   URL  : https://yourdomain.com/api/webhooks/bunny-encoding
//   Events: VideoEncoded (أو VideoEncodingFinished حسب الإصدار)
//
// الأمان:
//   Bunny يُرفق ترويسة "BunnySecurityToken" في كل طلب.
//   المفتاح يُحفظ في متغير بيئة: BUNNY_WEBHOOK_SECRET
//   إذا لم يُضبط المفتاح، يُقبل الطلب مع تحذير (وضع التطوير).
//   في الإنتاج يُرفض أي طلب بدون توقيع صحيح.
//
// payload Bunny يحتوي على:
//   VideoGuid      — نفس bunny_video_id المحفوظ في قاعدة بياناتنا
//   Status         — 3 = Finished, 4 = ResolutionFinished
//   VideoLength    — المدة بالثواني (متاح فور انتهاء التشفير)
//   LibraryId      — معرف المكتبة (للتحقق أن الحدث من مكتبتنا)
// ===================================================================

import { supabase } from '../../../lib/supabaseClient';

// ✅ تعطيل bodyParser الافتراضي لـ Next.js حتى نقرأ الجسم الخام للتحقق من التوقيع
export const config = {
  api: { bodyParser: false },
};

// قراءة جسم الطلب الخام كـ Buffer
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

export default async function handler(req, res) {
  // ── 1. قبول POST فقط ─────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── 2. قراءة الجسم الخام ─────────────────────────────────────────
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('❌ [bunny-webhook] Failed to read body:', err.message);
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  // ── 3. التحقق من التوقيع الأمني ──────────────────────────────────
  const webhookSecret = process.env.BUNNY_WEBHOOK_SECRET;

  if (webhookSecret) {
    const receivedToken = req.headers['bunnysecuritytoken'] || req.headers['bunny-security-token'];

    if (!receivedToken) {
      console.error('❌ [bunny-webhook] Missing security token header');
      return res.status(401).json({ error: 'Missing security token' });
    }

    // Bunny يستخدم HMAC-SHA256 على الجسم الخام
    const crypto = await import('crypto');
    const expectedToken = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (receivedToken !== expectedToken) {
      console.error('❌ [bunny-webhook] Invalid security token — request rejected');
      return res.status(401).json({ error: 'Invalid security token' });
    }
  } else {
    // لا يوجد سر محدد — اقبل لكن سجّل تحذيراً (مناسب فقط للتطوير)
    console.warn('⚠️ [bunny-webhook] BUNNY_WEBHOOK_SECRET not set — skipping signature check (dev mode)');
  }

  // ── 4. تحليل الـ payload ──────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('❌ [bunny-webhook] Invalid JSON payload:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const {
    VideoGuid: bunnyVideoId,
    Status: statusCode,
    VideoLength: videoLength,
    LibraryId: payloadLibraryId,
  } = payload;

  console.log(`📨 [bunny-webhook] Received event: status=${statusCode}, bunny_id=${bunnyVideoId}, length=${videoLength}`);

  // ── 5. التحقق أن الحدث من مكتبتنا ──────────────────────────────
  const ourLibraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  if (ourLibraryId && payloadLibraryId && String(payloadLibraryId) !== String(ourLibraryId)) {
    console.warn(`⚠️ [bunny-webhook] LibraryId mismatch: expected=${ourLibraryId}, got=${payloadLibraryId} — ignored`);
    // نُعيد 200 لمنع Bunny من إعادة المحاولة (retry) بدون داعٍ
    return res.status(200).json({ ignored: true, reason: 'wrong library' });
  }

  // ── 6. نهتم فقط بحالتَي الاكتمال (3 = Finished, 4 = ResolutionFinished) ──
  if (statusCode !== 3 && statusCode !== 4) {
    console.log(`ℹ️ [bunny-webhook] Ignoring status=${statusCode} for bunny_id=${bunnyVideoId}`);
    return res.status(200).json({ ignored: true, reason: 'non-completion status' });
  }

  if (!bunnyVideoId) {
    return res.status(400).json({ error: 'Missing VideoGuid in payload' });
  }

  // ── 7. البحث عن الفيديو في قاعدة البيانات بواسطة bunny_video_id ──
  const { data: video, error: fetchErr } = await supabase
    .from('videos')
    .select('id, duration')
    .eq('bunny_video_id', bunnyVideoId)
    .single();

  if (fetchErr || !video) {
    // قد يكون الفيديو محذوفاً أو من مكتبة أخرى — ليس خطأً حرجاً
    console.warn(`⚠️ [bunny-webhook] Video not found in DB for bunny_id=${bunnyVideoId}`);
    return res.status(200).json({ ignored: true, reason: 'video not found in DB' });
  }

  // ── 8. حساب المدة ────────────────────────────────────────────────
  // أولاً: نستخدم VideoLength من الـ payload مباشرة
  // إذا كانت 0 أو غائبة، نستعلم Bunny مرة واحدة للحصول على القيمة الحقيقية
  let durationSeconds = Number(videoLength) || 0;

  if (durationSeconds <= 0) {
    console.log(`🔍 [bunny-webhook] VideoLength missing in payload — fetching from Bunny API`);
    try {
      const apiKey = process.env.BUNNY_STREAM_API_KEY;
      const libraryId = ourLibraryId;
      const apiRes = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
        { headers: { AccessKey: apiKey, accept: 'application/json' } }
      );
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        durationSeconds = Number(apiData.length) || 0;
        console.log(`📏 [bunny-webhook] Fetched length from API: ${durationSeconds}s`);
      }
    } catch (apiErr) {
      console.error('❌ [bunny-webhook] Failed to fetch from Bunny API:', apiErr.message);
    }
  }

  if (durationSeconds <= 0) {
    // Bunny أخبرنا بالاكتمال لكن المدة لا تزال غير متاحة — غير متوقع، سجّل وأعد 200
    console.warn(`⚠️ [bunny-webhook] Encoding finished but duration still 0 for bunny_id=${bunnyVideoId}`);
    return res.status(200).json({ success: false, reason: 'duration unavailable' });
  }

  // ── 9. تحديث قاعدة البيانات إذا كانت المدة ناقصة ───────────────
  const currentDuration = video.duration || '00:00';
  const formatted = formatDuration(durationSeconds);

  if (currentDuration !== '00:00' && currentDuration === formatted) {
    // المدة صحيحة بالفعل (وصلت مسبقاً عبر الـ client)
    console.log(`✅ [bunny-webhook] Duration already correct (${currentDuration}) for db_id=${video.id} — no update needed`);
    return res.status(200).json({ success: true, duration: currentDuration, updated: false });
  }

  const { error: updateErr } = await supabase
    .from('videos')
    .update({ duration: formatted })
    .eq('id', video.id);

  if (updateErr) {
    console.error(`❌ [bunny-webhook] DB update failed for db_id=${video.id}:`, updateErr);
    // أعد 500 حتى يُعيد Bunny المحاولة
    return res.status(500).json({ error: 'DB update failed' });
  }

  console.log(`✅ [bunny-webhook] Duration updated: db_id=${video.id}, bunny_id=${bunnyVideoId}, duration=${formatted}`);

  return res.status(200).json({
    success: true,
    videoId: video.id,
    bunnyVideoId,
    duration: formatted,
    updated: true,
  });
}
