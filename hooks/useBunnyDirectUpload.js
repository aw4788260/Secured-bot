// hooks/useBunnyDirectUpload.js
// ===================================================================
// 🎯 Hook للرفع المباشر من جهاز المعلم إلى Bunny Stream (بدون المرور بالسيرفر)
// ===================================================================

import { useState, useRef, useCallback } from 'react';

/**
 * يحمّل مكتبة tus-js-client ديناميكياً (لا تُحمَّل إلا عند الحاجة)
 */
async function loadTus() {
  const tus = await import('tus-js-client');
  return tus;
}

/**
 * 👈 دالة متطورة لاستخراج مدة الفيديو محلياً من المتصفح
 * تعالج مشكلة (Infinity Bug) في متصفحات كروم عبر حدث 'seeked' بدلاً من 'ontimeupdate'
 * مع مهلة احتياطية (5 ثواني) لتجنب الانتظار اللانهائي
 * @param {File} file
 * @returns {Promise<number>} المدة بالثواني (0 عند الفشل)
 */
function getVideoDurationLocal(file) {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let objectUrl = null;

    const finish = (duration) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      // تنظيف الـ object URL لتحرير الذاكرة
      if (objectUrl) {
        try { window.URL.revokeObjectURL(objectUrl); } catch (_) {}
      }
      resolve(duration && !isNaN(duration) && isFinite(duration) && duration > 0 ? duration : 0);
    };

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      // مهلة 10 ثواني كحد أقصى لمنع الانتظار اللانهائي
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Duration extraction timed out');
        finish(0);
      }, 10000);

      objectUrl = window.URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        if (!isFinite(video.duration) || isNaN(video.duration)) {
          // ✅ الإصلاح الحقيقي لـ Infinity Bug:
          // نستخدم حدث 'seeked' بدلاً من 'ontimeupdate'
          // لأن ontimeupdate يُطلق قبل انتهاء عملية الـ seek فعلياً
          video.addEventListener('seeked', function onSeeked() {
            video.removeEventListener('seeked', onSeeked);
            finish(video.duration);
          });
          // نطلب الانتقال لنهاية الفيديو (1e101 أكبر من أي مدة ممكنة)
          video.currentTime = 1e101;
        } else {
          finish(video.duration);
        }
      };

      video.onerror = () => {
        console.error('❌ Video element error during metadata load');
        finish(0);
      };

      video.src = objectUrl;
    } catch (err) {
      console.error('❌ Local duration extraction error:', err);
      finish(0);
    }
  });
}

/**
 * @typedef {Object} UploadOptions
 * @property {File}     file            - ملف الفيديو المراد رفعه
 * @property {string}   chapterId       - معرف الفصل في قاعدة البيانات
 * @property {string}   [title]         - عنوان الفيديو 
 * @property {boolean}  [notifyStudents] 
 * @property {number}   [sortOrder]     
 * @property {Function} [onComplete]    
 * @property {Function} [onError]       
 */

export function useBunnyDirectUpload() {
  const [progress, setProgress]   = useState(0);   
  const [status, setStatus]       = useState('idle'); 
  const [error, setError]         = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const uploadRef = useRef(null); 

  const startUpload = useCallback(async (options) => {
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

    // ── الخطوة 0: استخراج مدة الفيديو أولاً (قبل أي استهلاك للذاكرة في الرفع) ──
    let localDuration = 0;
    try {
      localDuration = await getVideoDurationLocal(file);
      console.log("✅ Video duration extracted:", localDuration);
    } catch (durErr) {
      console.warn("⚠️ Failed to extract duration, will fallback to 0", durErr);
    }

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

    const { bunnyVideoId, libraryId, signature, expiresAt } = sessionData;
    setCurrentVideoId(bunnyVideoId);
    setStatus('uploading');

    // ── الخطوة 2: الرفع المباشر إلى Bunny عبر TUS ──────────────────
    try {
      const tus = await loadTus();

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 50 * 1024 * 1024, 

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
          durationSeconds: localDuration, // 👈 إرسال المدة المستخرجة مسبقاً بقوة
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

  const cancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setStatus('cancelled');
    setProgress(0);
  }, []);

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
    progress,    
    status,      
    error,       
    currentVideoId, 
  };
}
