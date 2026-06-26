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
 * تعالج مشكلة (Infinity Bug) في متصفحات كروم وتضمن استخراج المدة
 * @param {File} file 
 * @returns {Promise<number>} المدة بالثواني
 */
function getVideoDurationLocal(file) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = window.URL.createObjectURL(file);
      
      const cleanUpAndResolve = (duration) => {
        window.URL.revokeObjectURL(url);
        resolve(duration && !isNaN(duration) && duration !== Infinity ? duration : 0);
      };

      video.onloadedmetadata = () => {
        // إذا واجهنا خطأ Infinity الشهير، نجبر المتصفح على التوجه لآخر الفيديو لحساب المدة
        if (video.duration === Infinity || isNaN(video.duration)) {
          video.currentTime = 1e101; 
          video.ontimeupdate = () => {
            video.ontimeupdate = null; // نوقف الحدث بعد أول مرة
            cleanUpAndResolve(video.duration);
          };
        } else {
          cleanUpAndResolve(video.duration);
        }
      };

      video.onerror = () => cleanUpAndResolve(0);
      video.src = url;
    } catch (err) {
      console.error("Local duration extraction error:", err);
      resolve(0);
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
