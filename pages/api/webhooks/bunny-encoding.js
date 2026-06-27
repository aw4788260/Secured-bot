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
//     "VideoGuid": "657bb740-...",   ← نفس bunny_video_id في DB
//     "Status": 3                    ← 3=Finished, 4=ResolutionFinished
//   }
//
// الأمان (اختياري):
//   Bunny يُرفق التوقيع في هذه الترويسات:
//     X-BunnyStream-Signature         ← HMAC-SHA256 hex
//     X-BunnyStream-Signature-Version ← "v1"
//     X-BunnyStream-Signature-Algorithm ← "hmac-sha256"
//   المفتاح هو Library's Read-Only API key
//   احفظه في .env كـ BUNNY_WEBHOOK_SECRET (اختياري — إذا غاب نقبل بدون تحقق)
//
// عند وصول الحدث بـ Status=3 أو 4:
//   1. نجلب الـ length من Bunny API (لأنه غير موجود في الـ payload)
//   2. نحدث duration في جدول videos
// ===================================================================

import { supabase } from '../../../lib/supabaseClient';
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

  // ── 6. نهتم فقط بـ Finished(3) أو ResolutionFinished(4) ──────
  if (statusCode !== 3 && statusCode !== 4) {
    return res.status(200).json({ ignored: true, reason: `status ${statusCode} not a completion event` });
  }

  if (!bunnyVideoId) {
    return res.status(400).json({ error: 'Missing VideoGuid' });
  }

  // ── 7. جلب الفيديو من DB بواسطة bunny_video_id ───────────────
  const { data: video, error: fetchErr } = await supabase
    .from('videos')
    .select('id, duration')
    .eq('bunny_video_id', bunnyVideoId)
    .single();

  if (fetchErr || !video) {
    // محذوف أو من مكتبة أخرى — نُعيد 200 لمنع Bunny من إعادة المحاولة
    console.warn(`⚠️ [bunny-webhook] Video not found in DB: bunny_id=${bunnyVideoId}`);
    return res.status(200).json({ ignored: true, reason: 'not in DB' });
  }

  // ── 8. جلب المدة من Bunny API (الـ payload لا يحتوي عليها) ───
  // الـ payload يحتوي فقط على VideoGuid و Status و VideoLibraryId
  // يجب استعلام Bunny API للحصول على الـ length الفعلي
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

  // ── 9. تحديث DB ───────────────────────────────────────────────
  const formatted = formatDuration(durationSeconds);
  const currentDuration = video.duration || '00:00';

  // لا داعي للتحديث إذا كانت المدة صحيحة بالفعل
  if (currentDuration !== '00:00' && currentDuration === formatted) {
    console.log(`✅ [bunny-webhook] Duration already correct (${currentDuration}) for db_id=${video.id}`);
    return res.status(200).json({ success: true, duration: currentDuration, updated: false });
  }

  const { error: updateErr } = await supabase
    .from('videos')
    .update({ duration: formatted })
    .eq('id', video.id);

  if (updateErr) {
    console.error(`❌ [bunny-webhook] DB update failed for db_id=${video.id}:`, updateErr);
    // نُعيد 500 حتى يُعيد Bunny المحاولة
    return res.status(500).json({ error: 'DB update failed' });
  }

  console.log(`✅ [bunny-webhook] Duration updated: db_id=${video.id}, bunny_id=${bunnyVideoId}, ${currentDuration} → ${formatted}`);

  return res.status(200).json({
    success: true,
    videoId: video.id,
    bunnyVideoId,
    duration: formatted,
    updated: true,
  });
}
