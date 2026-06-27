// lib/bunnyStream.js
// ===================================================================
// 🐰 مكتبة مساعدة للتعامل مع Bunny Stream API (رفع الفيديوهات ومتابعة حالتها)
// ===================================================================
// هذا الملف لا يتعامل مع تشغيل الفيديو (هذا موجود مسبقاً في get-video-id.js)
// بل يتعامل فقط مع: إنشاء الفيديو + رفعه + الاستعلام عن حالة المعالجة (Encoding)
// ===================================================================

import axios from 'axios';

const BUNNY_API_BASE = 'https://video.bunnycdn.com';

// ✅ متغيرات البيئة المطلوبة لعمليات الرفع/الإدارة (تختلف عن مفتاح الـ Pull Zone
// المستخدم في get-video-id.js والذي يُستخدم فقط لتوليد روابط تشغيل موقّعة)
function getLibraryConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;

  if (!libraryId || !apiKey) {
    throw new Error('متغيرات البيئة الخاصة بـ Bunny Stream غير مكتملة (BUNNY_STREAM_LIBRARY_ID أو BUNNY_STREAM_API_KEY)');
  }

  return { libraryId, apiKey };
}

// ===================================================================
// 🧭 خريطة حالات الفيديو الرسمية من Bunny Stream (Webhook / Video Object status)
// 0 Queued | 1 Processing | 2 Encoding | 3 Finished
// 4 ResolutionFinished (أول جودة جاهزة وأصبح الفيديو قابلاً للعرض)
// 5 Failed | 6 PresignedUploadStarted | 7 PresignedUploadFinished | 8 PresignedUploadFailed
// ===================================================================
const BUNNY_STATUS_MAP = {
  0: { code: 'waiting', label: 'بانتظار المعالجة' },
  1: { code: 'processing', label: 'قيد المعالجة' },
  2: { code: 'processing', label: 'قيد المعالجة' },
  3: { code: 'ready', label: 'جاهز' },
  4: { code: 'ready', label: 'جاهز' },
  5: { code: 'failed', label: 'فشلت المعالجة' },
  6: { code: 'waiting', label: 'بانتظار المعالجة' },
  7: { code: 'processing', label: 'قيد المعالجة' },
  8: { code: 'failed', label: 'فشل الرفع' },
};

// يحوّل رقم الحالة القادم من Bunny إلى شكل واضح يفهمه الفرونت إند
export function mapBunnyStatus(statusCode, encodeProgress = 0) {
  const entry = BUNNY_STATUS_MAP[statusCode] || { code: 'unknown', label: 'غير معروف' };
  return {
    statusCode,
    status: entry.code, // waiting | processing | ready | failed | unknown
    label: entry.label, // النص العربي الجاهز للعرض
    encodeProgress: typeof encodeProgress === 'number' ? encodeProgress : 0,
  };
}

// ===================================================================
// 1. إنشاء كائن فيديو جديد في مكتبة Bunny Stream (بدون رفع المحتوى الفعلي بعد)
// يرجع videoId الذي سيُستخدم بعد ذلك للرفع وللاستعلام عن الحالة
// ===================================================================
export async function createBunnyVideo(title) {
  const { libraryId, apiKey } = getLibraryConfig();

  const response = await axios.post(
    `${BUNNY_API_BASE}/library/${libraryId}/videos`,
    { title: title || 'Untitled' },
    {
      headers: {
        AccessKey: apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      timeout: 20000,
    }
  );

  // الحقل المرجعي لمعرف الفيديو في رد Bunny هو guid
  return response.data?.guid;
}

// ===================================================================
// 2. رفع محتوى الفيديو الفعلي (Binary) إلى كائن الفيديو الذي تم إنشاؤه أعلاه
// ✅ هذا الطلب ينتهي فور اكتمال استقبال البيانات على سيرفرات Bunny
// (لا ننتظر هنا انتهاء التحويل لجودات متعددة - هذا يحدث في الخلفية على Bunny)
// ===================================================================
export async function uploadBunnyVideoContent(videoId, fileStream, fileSize) {
  const { libraryId, apiKey } = getLibraryConfig();

  const response = await axios.put(
    `${BUNNY_API_BASE}/library/${libraryId}/videos/${videoId}`,
    fileStream,
    {
      headers: {
        AccessKey: apiKey,
        accept: 'application/json',
        'content-type': 'application/octet-stream',
        'content-length': fileSize,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 0, // قد يستغرق الرفع وقتاً طويلاً حسب حجم الملف وسرعة الاتصال
    }
  );

  return response.data;
}

// ===================================================================
// 3. حذف فيديو من Bunny Stream (تنظيف في حال فشلت أي خطوة لاحقة)
// ===================================================================
export async function deleteBunnyVideo(videoId) {
  const { libraryId, apiKey } = getLibraryConfig();

  try {
    await axios.delete(`${BUNNY_API_BASE}/library/${libraryId}/videos/${videoId}`, {
      headers: { AccessKey: apiKey, accept: 'application/json' },
      timeout: 15000,
    });
  } catch (e) {
    // تنظيف غير حرج - لا نوقف العملية الأساسية بسببه
    console.error('⚠️ [Bunny] Failed to cleanup video after error:', e.message);
  }
}

// ===================================================================
// 4. الاستعلام عن حالة فيديو واحد فقط (وليس كل الفيديوهات) لمعرفة هل انتهت
// المعالجة (Encoding) لكافة الجودات أو لا يزال قيد العمل
// ✅ يُعيد أيضاً حقل length (المدة بالثواني) إن أتاحه Bunny بعد انتهاء التحويل
// ===================================================================
export async function getBunnyVideoStatus(videoId) {
  const { libraryId, apiKey } = getLibraryConfig();

  const response = await axios.get(`${BUNNY_API_BASE}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey, accept: 'application/json' },
    timeout: 15000,
  });

  const data = response.data || {};
  return {
    ...mapBunnyStatus(data.status, data.encodeProgress),
    length: data.length || 0, // المدة بالثواني — 0 ريثما تنتهي المعالجة
  };
}
