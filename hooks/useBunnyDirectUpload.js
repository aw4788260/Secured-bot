// hooks/useBunnyDirectUpload.js
// ===================================================================
// 🎯 Hook للرفع المباشر من جهاز المعلم إلى Bunny Stream (بدون المرور بالسيرفر)
// ===================================================================

import { useState, useRef, useCallback } from 'react';

async function loadTus() {
  const tus = await import('tus-js-client');
  return tus;
}

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
    // ✅ FIX: توسيع نافذة انتهاء الصلاحية — نتحقق فقط إذا انتهت فعلاً (لا هامش 60 ثانية)
    if (session.expiresAt && Date.now() / 1000 > session.expiresAt) {
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

// ✅ FIX: استخراج مدة الفيديو مع timeout قصير (5s) بدلاً من 10s
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
      // ✅ FIX: تقليل timeout من 10s إلى 5s لتسريع العملية
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Duration extraction timed out');
        finish(0);
      }, 5000);

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

      video.onerror = () => finish(0);
      video.src = objectUrl;
    } catch (err) {
      finish(0);
    }
  });
}

// ✅ FIX: wrapper لـ fetch مع timeout لمنع التعليق عند confirm-upload
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`انتهت مهلة الطلب بعد ${timeoutMs / 1000} ثانية`);
    }
    throw err;
  }
}

export function useBunnyDirectUpload() {
  const [progress, setProgress]   = useState(0);
  const [status, setStatus]       = useState('idle');
  const [error, setError]         = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const uploadRef = useRef(null);
  const lastUploadOptionsRef = useRef(null);

  // ✅ FIX: دالة لإنشاء جلسة جديدة وحذف القديمة
  async function _createFreshSession({ file, chapterId, title, notifyStudents, sortOrder, localDuration }) {
    // حذف الجلسة القديمة وبيانات TUS
    clearSession(file);
    await clearTusInternalStorage(file);

    const sessionRes = await fetchWithTimeout('/api/dashboard/teacher/create-upload-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterId,
        title: title || file.name,
        fileSize: file.size,
      }),
    }, 15000);

    if (!sessionRes.ok) {
      const errData = await sessionRes.json().catch(() => ({}));
      throw new Error(errData.error || `فشل إنشاء جلسة الرفع (${sessionRes.status})`);
    }

    const sessionData = await sessionRes.json();

    saveSession(file, {
      ...sessionData,
      localDuration,
      chapterId,
      title: title || file.name,
      notifyStudents,
      sortOrder,
    });

    return sessionData;
  }

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
    } catch (_) {}

    // ── الخطوة 1: جلسة الرفع — إعادة استخدام المحفوظة أو إنشاء جديدة ──
    let sessionData = loadSession(file);

    if (sessionData) {
      console.log('♻️ Resuming existing session for bunnyVideoId=', sessionData.bunnyVideoId);
      setStatus('uploading');
      if (localDuration <= 0 && sessionData.localDuration > 0) {
        localDuration = sessionData.localDuration;
      }
    } else {
      setStatus('requesting');
      try {
        sessionData = await _createFreshSession({ file, chapterId, title, notifyStudents, sortOrder, localDuration });
        setStatus('uploading');
      } catch (err) {
        setError(err.message);
        setStatus('error');
        onError?.(err);
        return;
      }
    }

    const { bunnyVideoId } = sessionData;
    setCurrentVideoId(bunnyVideoId);

    lastUploadOptionsRef.current = {
      file,
      sessionData,
      localDuration,
      chapterId,
      title,
      notifyStudents,
      sortOrder,
      onComplete,
      onError,
    };

    await _doTusUpload({ file, sessionData, localDuration, onComplete, onError, setProgress, setStatus, setError, uploadRef });

  }, []);

  async function _doTusUpload({ file, sessionData, localDuration, onComplete, onError, setProgress, setStatus, setError, uploadRef }) {
    const { bunnyVideoId, libraryId, signature, expiresAt, chapterId, title, notifyStudents, sortOrder } = sessionData;

    try {
      const tus = await loadTus();

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: 'https://video.bunnycdn.com/tusupload',

          // ✅ FIX: تقليل retryDelays — إعادة المحاولة أسرع بعد الانقطاع
          retryDelays: [0, 2000, 5000, 10000, 20000, 30000, 60000],

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
            // ✅ FIX: تحديث التقدم لكن نقف عند 99% حتى يكتمل confirm
            const pct = Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100));
            setProgress(pct);
          },

          onSuccess() {
            clearSession(file);
            resolve();
          },
        });

        uploadRef.current = upload;

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
        }).catch(() => {
          upload.start();
        });
      });

    } catch (err) {
      if (err?.message === 'CANCELLED') {
        setStatus('cancelled');
        return;
      }

      const httpStatus = err?.originalResponse?.getStatus?.();
      const isStaleSession = httpStatus === 401 || httpStatus === 404;

      if (isStaleSession) {
        // ✅ FIX: جلسة منتهية — ننشئ جلسة جديدة تلقائياً ونحاول مرة أخرى
        console.warn(`⚠️ Stale session (HTTP ${httpStatus}) — recreating session automatically`);
        setStatus('requesting');
        setError(null);

        const opts = lastUploadOptionsRef.current;
        if (!opts) {
          setError('فشل استئناف الرفع — يرجى تحديد الملف مرة أخرى');
          setStatus('error');
          onError?.(err);
          return;
        }

        try {
          const newSession = await _createFreshSession({
            file: opts.file,
            chapterId: opts.chapterId || sessionData.chapterId,
            title: opts.title || sessionData.title,
            notifyStudents: opts.notifyStudents ?? sessionData.notifyStudents,
            sortOrder: opts.sortOrder ?? sessionData.sortOrder,
            localDuration: localDuration || sessionData.localDuration || 0,
          });

          // تحديث lastUploadOptionsRef بالجلسة الجديدة
          lastUploadOptionsRef.current = { ...opts, sessionData: newSession };
          setCurrentVideoId(newSession.bunnyVideoId);
          setStatus('uploading');

          // إعادة المحاولة بالجلسة الجديدة
          await _doTusUpload({
            file: opts.file,
            sessionData: newSession,
            localDuration: localDuration || sessionData.localDuration || 0,
            onComplete: opts.onComplete,
            onError: opts.onError,
            setProgress,
            setStatus,
            setError,
            uploadRef,
          });
          return;
        } catch (recreateErr) {
          setError(`فشل إنشاء جلسة جديدة: ${recreateErr.message}`);
          setStatus('error');
          onError?.(recreateErr);
          return;
        }
      }

      setError('انقطع الاتصال — اضغط "استكمال" للمتابعة من نقطة التوقف');
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
      // ✅ FIX: timeout 30s لمنع تعليق مرحلة "حفظ البيانات" إلى الأبد
      const confirmRes = await fetchWithTimeout('/api/dashboard/teacher/confirm-upload', {
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
      }, 30000);

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

  // ✅ FIX: resume موحد — يحاول الاستئناف، وإن فشل بـ 401/404 يُعيد إنشاء الجلسة تلقائياً
  const resume = useCallback(() => {
    const savedOptions = lastUploadOptionsRef.current;
    if (!savedOptions) {
      console.warn('⚠️ resume called but no saved upload options found');
      return;
    }

    setError(null);
    setStatus('uploading');

    if (uploadRef.current) {
      try { uploadRef.current.abort(); } catch (_) {}
      uploadRef.current = null;
    }

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
