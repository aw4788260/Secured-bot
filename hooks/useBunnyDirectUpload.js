// hooks/useBunnyDirectUpload.js
// ===================================================================
// 🎯 Hook للرفع المباشر من جهاز المعلم إلى Bunny Stream (بدون المرور بالسيرفر)
// ===================================================================
// الاستخدام:
//   const { startUpload, progress, status, error, cancel } = useBunnyDirectUpload();
//   await startUpload({ file, chapterId, title, onComplete });
// ===================================================================

import { useState, useRef, useCallback } from 'react';

/**
 * يحمّل مكتبة tus-js-client ديناميكياً (لا تُحمَّل إلا عند الحاجة)
 * هذا يتجنب زيادة حجم الـ Bundle للصفحات التي لا ترفع فيديو
 */
async function loadTus() {
  const tus = await import('tus-js-client');
  return tus;
}

/**
 * 👈 دالة لاستخراج مدة الفيديو محلياً من المتصفح قبل إرسال التأكيد للسيرفر
 * @param {File} file 
 * @returns {Promise<number>} المدة بالثواني
 */
function getVideoDurationLocal(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration); // يرجع المدة بالثواني
    };
    video.onerror = () => resolve(0); // في حال فشل القراءة
    video.src = window.URL.createObjectURL(file);
  });
}

/**
 * @typedef {Object} UploadOptions
 * @property {File}     file            - ملف الفيديو المراد رفعه
 * @property {string}   chapterId       - معرف الفصل في قاعدة البيانات
 * @property {string}   [title]         - عنوان الفيديو (افتراضي: اسم الملف)
 * @property {boolean}  [notifyStudents] - إرسال إشعار FCM للطلاب بعد الاكتمال
 * @property {number}   [sortOrder]     - ترتيب الفيديو داخل الفصل
 * @property {Function} [onComplete]    - callback يُستدعى بعد حفظ الفيديو في DB
 * @property {Function} [onError]       - callback عند حدوث خطأ
 */

export function useBunnyDirectUpload() {
  const [progress, setProgress]   = useState(0);   // 0–100
  const [status, setStatus]       = useState('idle'); // idle | requesting | uploading | confirming | done | error | cancelled
  const [error, setError]         = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const uploadRef = useRef(null); // مرجع لكائن TUS Upload (للإلغاء)

  /**
   * بدء عملية الرفع الكاملة:
   * 1. طلب جلسة رفع من السيرفر (token/URL فقط)
   * 2. الرفع المباشر إلى Bunny عبر TUS
   * 3. تأكيد الحفظ في DB
   */
  const startUpload = useCallback(async (/** @type {UploadOptions} */ options) => {
    const {
      file,
      chapterId,
      title,
      notifyStudents = false,
      sortOrder = 999,
      onComplete,
      onError,
    } = options;

    if (!file || !chapterId) {
      const msg = 'file و chapterId مطلوبان';
      setError(msg);
      setStatus('error');
      onError?.(new Error(msg));
      return;
    }

    setError(null);
    setProgress(0);
    setStatus('requesting');
    setCurrentVideoId(null);

    // ── الخطوة 1: طلب جلسة الرفع من السيرفر ────────────────────────
    let sessionData;
    try {
      const sessionRes = await fetch('/api/dashboard/teacher/create-upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          title: title || file.name,
          fileSize: file.size,
        }),
      });

      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        throw new Error(errData.error || `فشل إنشاء جلسة الرفع (${sessionRes.status})`);
      }

      sessionData = await sessionRes.json();
    } catch (err) {
      setError(err.message);
      setStatus('error');
      onError?.(err);
      return;
    }

    // استلام بيانات التوثيق والتوقيع بدلاً من رابط الرفع
    const { bunnyVideoId, libraryId, signature, expiresAt } = sessionData;
    setCurrentVideoId(bunnyVideoId);
    setStatus('uploading');

    // ── الخطوة 2: الرفع المباشر إلى Bunny عبر TUS ──────────────────
    try {
      const tus = await loadTus();

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          // استخدام الرابط الثابت الرسمي الخاص بـ Bunny TUS
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000], // إعادة المحاولة تلقائياً
          chunkSize: 50 * 1024 * 1024, // 50 MB chunk — مناسب للاتصالات المتذبذبة

          // تمرير بيانات التوثيق والتوقيع كترويسات (Headers)
          headers: {
            AuthorizationSignature: signature,
            AuthorizationExpire: String(expiresAt),
            VideoId: bunnyVideoId,
            LibraryId: String(libraryId),
          },

          metadata: {
            filename: file.name,
            filetype: file.type || 'video/mp4',
            title: title || file.name
          },

          onError(err) {
            reject(err);
          },

          onProgress(bytesUploaded, bytesTotal) {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setProgress(pct);
          },

          onSuccess() {
            resolve();
          },
        });

        uploadRef.current = upload;
        upload.start();
      });
    } catch (err) {
      if (err?.message === 'CANCELLED') {
        setStatus('cancelled');
        return;
      }
      setError(`فشل الرفع إلى Bunny: ${err.message}`);
      setStatus('error');
      onError?.(err);
      return;
    }

    // ── الخطوة 3: تأكيد الحفظ في قاعدة البيانات ────────────────────
    setStatus('confirming');
    setProgress(100);

    // 👈 استخراج مدة الفيديو محلياً بالثواني
    const durationInSeconds = await getVideoDurationLocal(file);

    try {
      const confirmRes = await fetch('/api/dashboard/teacher/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bunnyVideoId,
          chapterId,
          title: title || file.name,
          notifyStudents,
          sortOrder,
          durationSeconds: durationInSeconds, // 👈 إرسال المدة مع الطلب
        }),
      });

      if (!confirmRes.ok) {
        const errData = await confirmRes.json().catch(() => ({}));
        throw new Error(errData.error || `فشل تأكيد الرفع (${confirmRes.status})`);
      }

      const confirmData = await confirmRes.json();
      setStatus('done');
      onComplete?.(confirmData);
    } catch (err) {
      setError(`اكتمل الرفع لكن فشل الحفظ في قاعدة البيانات: ${err.message}`);
      setStatus('error');
      onError?.(err);
    }
  }, []);

  /** إلغاء الرفع الجاري */
  const cancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setStatus('cancelled');
    setProgress(0);
  }, []);

  /** إعادة التهيئة */
  const reset = useCallback(() => {
    uploadRef.current = null;
    setProgress(0);
    setStatus('idle');
    setError(null);
    setCurrentVideoId(null);
  }, []);

  return {
    startUpload,
    cancel,
    reset,
    progress,    // رقم 0–100
    status,      // 'idle' | 'requesting' | 'uploading' | 'confirming' | 'done' | 'error' | 'cancelled'
    error,       // نص الخطأ أو null
    currentVideoId, // bunnyVideoId الحالي (مفيد لمتابعة الحالة لاحقاً)
  };
}
