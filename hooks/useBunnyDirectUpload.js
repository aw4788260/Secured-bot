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
 * بصمة الملف — مفتاح فريد يعتمد على اسم الملف + حجمه + آخر تعديل
 */
function getFileFingerprint(file) {
  return `bunny-session:${file.name}:${file.size}:${file.lastModified}`;
}

function saveSession(file, data) {
  try {
    localStorage.setItem(getFileFingerprint(file), JSON.stringify(data));
  } catch (_) {}
}

function loadSession(file) {
  try {
    const raw = localStorage.getItem(getFileFingerprint(file));
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() / 1000 > session.expiresAt - 60) {
      localStorage.removeItem(getFileFingerprint(file));
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

function clearSession(file) {
  try {
    localStorage.removeItem(getFileFingerprint(file));
  } catch (_) {}
}

async function clearTusInternalStorage(file) {
  try {
    const tus = await loadTus();
    if (!tus.WebStorageUrlStorage) return;
    const storage = new tus.WebStorageUrlStorage();
    const fingerprint = await tus.defaultOptions.fingerprint(file, {
      endpoint: 'https://video.bunnycdn.com/tusupload',
    });
    const previousUploads = await storage.findUploadsByFingerprint(fingerprint);
    await Promise.all(previousUploads.map((u) => storage.removeUpload(u.urlStorageKey)));
  } catch (_) {}
}

function getVideoDurationLocal(file) {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let objectUrl = null;

    const finish = (duration) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (objectUrl) {
        try { window.URL.revokeObjectURL(objectUrl); } catch (_) {}
      }
      resolve(duration && !isNaN(duration) && isFinite(duration) && duration > 0 ? duration : 0);
    };

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Duration extraction timed out');
        finish(0);
      }, 10000);

      objectUrl = window.URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        if (!isFinite(video.duration) || isNaN(video.duration)) {
          video.addEventListener('seeked', function onSeeked() {
            video.removeEventListener('seeked', onSeeked);
            finish(video.duration);
          });
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

export function useBunnyDirectUpload() {
  const [progress, setProgress]   = useState(0);
  const [status, setStatus]       = useState('idle');
  const [error, setError]         = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const uploadRef = useRef(null);
  // ✅ FIX: نحتفظ بنسخة من options الخاصة بآخر رفع لإعادة البناء عند الاستئناف
  const lastUploadOptionsRef = useRef(null);

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
    setCurrentVideoId(null);

    // ── الخطوة 0: استخراج مدة الفيديو محلياً ───────────────────────
    let localDuration = 0;
    try {
      localDuration = await getVideoDurationLocal(file);
      console.log('✅ Video duration extracted:', localDuration);
    } catch (durErr) {
      console.warn('⚠️ Failed to extract duration, will fallback to 0', durErr);
    }

    // ── الخطوة 1: جلسة الرفع — إعادة استخدام المحفوظة أو إنشاء جديدة ──
    let sessionData = loadSession(file);

    if (sessionData) {
      console.log('♻️ Resuming existing upload session for bunnyVideoId=', sessionData.bunnyVideoId);
      setStatus('uploading');
      if (localDuration <= 0 && sessionData.localDuration > 0) {
        localDuration = sessionData.localDuration;
      }
    } else {
      setStatus('requesting');
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

        saveSession(file, {
          ...sessionData,
          localDuration,
          chapterId,
          title: title || file.name,
          notifyStudents,
          sortOrder,
        });

        setStatus('uploading');
      } catch (err) {
        setError(err.message);
        setStatus('error');
        onError?.(err);
        return;
      }
    }

    const { bunnyVideoId, libraryId, signature, expiresAt } = sessionData;
    setCurrentVideoId(bunnyVideoId);

    // ✅ FIX: نحفظ كل options المطلوبة لإعادة بناء كائن TUS عند الاستئناف
    lastUploadOptionsRef.current = {
      file,
      sessionData,
      localDuration,
      onComplete,
      onError,
    };

    // ── الخطوة 2: الرفع المباشر إلى Bunny عبر TUS ──────────────────
    await _doTusUpload({ file, sessionData, localDuration, onComplete, onError, setProgress, setStatus, setError, uploadRef });

  }, []);

  // ✅ FIX: دالة مساعدة داخلية لبناء وتشغيل كائن TUS — تُستخدم من startUpload ومن resume
  async function _doTusUpload({ file, sessionData, localDuration, onComplete, onError, setProgress, setStatus, setError, uploadRef }) {
    const { bunnyVideoId, libraryId, signature, expiresAt, chapterId, title, notifyStudents, sortOrder } = sessionData;

    try {
      const tus = await loadTus();

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: 'https://video.bunnycdn.com/tusupload',

          // ✅ الطريقة الرسمية من Bunny لإعادة المحاولة تلقائياً عند انقطاع الإنترنت
          retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000, 60000, 60000],

          chunkSize: 50 * 1024 * 1024,

          removeFingerprintOnSuccess: true,

          headers: {
            AuthorizationSignature: signature,
            AuthorizationExpire: String(expiresAt),
            VideoId: bunnyVideoId,
            LibraryId: String(libraryId),
          },

          metadata: {
            filename: file.name,
            filetype: file.type || 'video/mp4',
            title: title || file.name,
          },

          onError(err) {
            reject(err);
          },

          onProgress(bytesUploaded, bytesTotal) {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setProgress(pct);
          },

          onSuccess() {
            clearSession(file);
            resolve();
          },
        });

        uploadRef.current = upload;

        // ✅ الطريقة الرسمية الموصى بها من tus-js-client و Bunny:
        //   findPreviousUploads ← تجد رابط الـ offset المحفوظ محلياً في localStorage
        //   resumeFromPreviousUpload ← تُبلغ الـ upload object بنقطة الاستئناف
        //   ثم start() لبدء/استكمال الرفع
        upload.findPreviousUploads().then((previousUploads) => {
          if (previousUploads.length > 0) {
            const mostRecent = previousUploads.reduce((latest, current) => {
              const latestTime = new Date(latest.creationTime || 0).getTime();
              const currentTime = new Date(current.creationTime || 0).getTime();
              return currentTime > latestTime ? current : latest;
            });
            console.log('♻️ Found previous tus upload, resuming from offset');
            upload.resumeFromPreviousUpload(mostRecent);
          }
          upload.start();
        }).catch((err) => {
          console.warn('⚠️ findPreviousUploads failed, starting fresh upload', err);
          upload.start();
        });
      });
    } catch (err) {
      if (err?.message === 'CANCELLED') {
        setStatus('cancelled');
        return;
      }

      const httpStatus = err?.originalResponse?.getStatus?.();
      const isStaleVideo = httpStatus === 401 || httpStatus === 404;

      if (isStaleVideo) {
        console.warn(`⚠️ Upload failed permanently (HTTP ${httpStatus}) — clearing stale session`);
        clearSession(file);
        clearTusInternalStorage(file);
        setError('انتهت صلاحية جلسة الرفع السابقة أو لم يعد الفيديو موجوداً على السيرفر — اضغط حفظ لبدء رفع جديد من الصفر');
      } else {
        setError('انقطع الاتصال — اضغط "استكمال الرفع" لاستئناف من نقطة التوقف');
      }
      setStatus('error');
      onError?.(err);
      return;
    }

    // ── الخطوة 3: تأكيد الحفظ في قاعدة البيانات ────────────────────
    setStatus('confirming');
    setProgress(100);

    const finalChapterId     = sessionData.chapterId     || chapterId;
    const finalTitle         = sessionData.title         || title || file.name;
    const finalNotify        = sessionData.notifyStudents ?? notifyStudents;
    const finalSortOrder     = sessionData.sortOrder     ?? sortOrder;
    const finalDuration      = localDuration > 0 ? localDuration : (sessionData.localDuration || 0);

    try {
      const confirmRes = await fetch('/api/dashboard/teacher/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bunnyVideoId,
          chapterId:      finalChapterId,
          title:          finalTitle,
          notifyStudents: finalNotify,
          sortOrder:      finalSortOrder,
          durationSeconds: finalDuration,
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
  }

  const cancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setStatus('cancelled');
    setProgress(0);
  }, []);

  // ✅ FIX: resume الصحيح — يبني كائن TUS جديداً بدلاً من إعادة استخدام كائن ميت
  // السبب: بعد انقطاع الاتصال، كائن TUS القديم في uploadRef يكون في حالة خطأ داخلية
  // واستدعاء start() عليه لن يُكمل الرفع بشكل موثوق. الطريقة الرسمية هي
  // بناء Upload object جديد ثم findPreviousUploads → resumeFromPreviousUpload → start()
  const resume = useCallback(() => {
    const savedOptions = lastUploadOptionsRef.current;
    if (!savedOptions) {
      console.warn('⚠️ resume called but no saved upload options found');
      return;
    }

    setError(null);
    setStatus('uploading');

    // إلغاء الكائن القديم إن وُجد
    if (uploadRef.current) {
      try { uploadRef.current.abort(); } catch (_) {}
      uploadRef.current = null;
    }

    // بناء كائن TUS جديد ← الطريقة الرسمية الموثوقة للاستئناف
    _doTusUpload({
      ...savedOptions,
      setProgress,
      setStatus,
      setError,
      uploadRef,
    });
  }, []);

  const reset = useCallback((file) => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    if (file) {
      clearSession(file);
      clearTusInternalStorage(file);
    }
    lastUploadOptionsRef.current = null;
    setProgress(0);
    setStatus('idle');
    setError(null);
    setCurrentVideoId(null);
  }, []);

  return {
    startUpload,
    cancel,
    reset,
    resume,
    progress,
    status,
    error,
    currentVideoId,
  };
}
