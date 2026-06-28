// hooks/useBunnyDirectUpload.js
import { useState, useRef, useCallback } from 'react';

async function loadTus() {
  const tus = await import('tus-js-client');
  return tus;
}

function getFileFingerprint(file) {
  return `bunny-session:${file.name}:${file.size}:${file.lastModified}`;
}

function saveSession(file, data) {
  try { localStorage.setItem(getFileFingerprint(file), JSON.stringify(data)); } catch (_) {}
}

function loadSession(file) {
  try {
    const raw = localStorage.getItem(getFileFingerprint(file));
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() / 1000 > session.expiresAt) {
      localStorage.removeItem(getFileFingerprint(file));
      return null;
    }
    return session;
  } catch (_) { return null; }
}

function clearSession(file) {
  try { localStorage.removeItem(getFileFingerprint(file)); } catch (_) {}
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
      if (objectUrl) { try { window.URL.revokeObjectURL(objectUrl); } catch (_) {} }
      resolve(duration && !isNaN(duration) && isFinite(duration) && duration > 0 ? duration : 0);
    };
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      timeoutId = setTimeout(() => finish(0), 5000);
      objectUrl = window.URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        if (!isFinite(video.duration) || isNaN(video.duration)) {
          video.addEventListener('seeked', function onSeeked() {
            video.removeEventListener('seeked', onSeeked);
            finish(video.duration);
          });
          video.currentTime = 1e101;
        } else { finish(video.duration); }
      };
      video.onerror = () => finish(0);
      video.src = objectUrl;
    } catch (_) { finish(0); }
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error(`انتهت مهلة الطلب بعد ${timeoutMs / 1000} ثانية`);
    throw err;
  }
}

// ── دالة TUS نقية: تُنشئ كائناً واحداً، ترفع، وتُعيد النتيجة ──────────────
// لا تلمس أي state — فقط ترفع وتُعيد { ok: true } أو تُلقي خطأ.
// هذا يجعلها قابلة للاستدعاء من حلقة retry خارجية بشكل نظيف.
function runTusUpload({ file, sessionData, onProgress, uploadRef }) {
  return new Promise((resolve, reject) => {
    loadTus().then((tus) => {
      const { bunnyVideoId, libraryId, signature, expiresAt, title } = sessionData;

      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',

        // retryDelays: null — نريد فشلاً فورياً عند انقطاع الاتصال.
        // إعادة المحاولة يتولاها الكود الخارجي بشكل واضح وقابل للتحكم.
        retryDelays: null,

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

        onError(err) { reject(err); },
        onProgress,
        onSuccess() { clearSession(file); resolve(); },
      });

      uploadRef.current = upload;

      upload.findPreviousUploads().then((prev) => {
        if (prev.length > 0) {
          const latest = prev.reduce((a, b) =>
            new Date(b.creationTime || 0) > new Date(a.creationTime || 0) ? b : a
          );
          upload.resumeFromPreviousUpload(latest);
        }
        upload.start();
      }).catch(() => upload.start());

    }).catch(reject);
  });
}

export function useBunnyDirectUpload() {
  const [progress, setProgress]   = useState(0);
  const [status, setStatus]       = useState('idle');
  const [error, setError]         = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const uploadRef        = useRef(null);
  const lastOptsRef      = useRef(null);
  const cancelledRef     = useRef(false); // لوقف حلقة retry عند cancel()

  async function _createFreshSession({ file, chapterId, title, notifyStudents, sortOrder, localDuration }) {
    clearSession(file);
    await clearTusInternalStorage(file);
    const sessionRes = await fetchWithTimeout('/api/dashboard/teacher/create-upload-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, title: title || file.name, fileSize: file.size }),
    }, 15000);
    if (!sessionRes.ok) {
      const e = await sessionRes.json().catch(() => ({}));
      throw new Error(e.error || `فشل إنشاء جلسة الرفع (${sessionRes.status})`);
    }
    const sessionData = await sessionRes.json();
    saveSession(file, { ...sessionData, localDuration, chapterId, title: title || file.name, notifyStudents, sortOrder });
    return sessionData;
  }

  // ── حلقة الرفع الرئيسية ───────────────────────────────────────────────
  // تُحاول runTusUpload مرات عديدة بانتظار ثابت (2 ثانية) بينها.
  // الانتظار يمنح المتصفح وقتاً كافياً لاستعادة الاتصال بعد عودة الواي فاي.
  // الفشل الفوري (retryDelays:null) + انتظار 2 ثانية من الخارج =
  //   استجابة سريعة للانقطاع + مقاومة كافية لعدم استقرار الشبكة.
  async function _uploadLoop({ file, sessionData, localDuration, onComplete, onError }) {
    const MAX_ATTEMPTS = 5;
    const RETRY_WAIT_MS = 2000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (cancelledRef.current) return;

      try {
        await runTusUpload({
          file,
          sessionData,
          uploadRef,
          onProgress(bytesUploaded, bytesTotal) {
            setProgress(Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100)));
          },
        });
      } catch (err) {
        uploadRef.current = null;

        // إلغاء صريح — نخرج بصمت، cancel() تتولى الحالة
        if (cancelledRef.current) return;

        const httpStatus = err?.originalResponse?.getStatus?.();

        // جلسة منتهية — نُعيد إنشاءها ونبدأ من الصفر
        if (httpStatus === 401 || httpStatus === 404) {
          setStatus('requesting');
          setError(null);
          try {
            const opts = lastOptsRef.current;
            sessionData = await _createFreshSession({
              file,
              chapterId: opts?.chapterId || sessionData.chapterId,
              title: opts?.title || sessionData.title,
              notifyStudents: opts?.notifyStudents ?? sessionData.notifyStudents,
              sortOrder: opts?.sortOrder ?? sessionData.sortOrder,
              localDuration: localDuration || sessionData.localDuration || 0,
            });
            lastOptsRef.current = { ...lastOptsRef.current, sessionData };
            setCurrentVideoId(sessionData.bunnyVideoId);
            setStatus('uploading');
            attempt = 0; // إعادة العداد مع الجلسة الجديدة
            continue;
          } catch (recreateErr) {
            setError(`فشل إنشاء جلسة جديدة: ${recreateErr.message}`);
            setStatus('error');
            onError?.(recreateErr);
            return;
          }
        }

        // انقطاع شبكة — إذا بقت محاولات نُعيد المحاولة بعد انتظار قصير
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`⚠️ Upload attempt ${attempt} failed, retrying in ${RETRY_WAIT_MS}ms...`);
          await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
          continue;
        }

        // استنزفنا كل المحاولات — نُخبر المستخدم
        setError('انقطع الاتصال — اضغط "حفظ" للمتابعة من نقطة التوقف');
        setStatus('error');
        onError?.(err);
        return;
      }

      // وصلنا هنا = TUS أكمل بنجاح — نخرج من الحلقة
      break;
    }

    if (cancelledRef.current) return;

    // ── تأكيد الحفظ في قاعدة البيانات ──────────────────────────────
    setStatus('confirming');
    setProgress(100);

    const { bunnyVideoId, chapterId, title, notifyStudents, sortOrder } = sessionData;
    const finalChapterId = sessionData.chapterId || chapterId;
    const finalTitle     = sessionData.title     || title || file.name;
    const finalNotify    = sessionData.notifyStudents ?? notifyStudents;
    const finalSortOrder = sessionData.sortOrder  ?? sortOrder;
    const finalDuration  = localDuration > 0 ? localDuration : (sessionData.localDuration || 0);

    try {
      const confirmRes = await fetchWithTimeout('/api/dashboard/teacher/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bunnyVideoId,
          chapterId:       finalChapterId,
          title:           finalTitle,
          notifyStudents:  finalNotify,
          sortOrder:       finalSortOrder,
          durationSeconds: finalDuration,
        }),
      }, 30000);

      if (!confirmRes.ok) {
        const e = await confirmRes.json().catch(() => ({}));
        throw new Error(e.error || `فشل تأكيد الرفع (${confirmRes.status})`);
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

  const startUpload = useCallback(async (options) => {
    const { file, chapterId, title, notifyStudents = false, sortOrder = 999, onComplete, onError } = options;

    if (!file || !chapterId) {
      const msg = 'file و chapterId مطلوبان';
      setError(msg); setStatus('error'); onError?.(new Error(msg)); return;
    }

    cancelledRef.current = false;
    setError(null); setProgress(0); setCurrentVideoId(null);

    let localDuration = 0;
    try { localDuration = await getVideoDurationLocal(file); } catch (_) {}

    let sessionData = loadSession(file);

    if (sessionData) {
      setStatus('uploading');
      if (localDuration <= 0 && sessionData.localDuration > 0) localDuration = sessionData.localDuration;
    } else {
      setStatus('requesting');
      try {
        sessionData = await _createFreshSession({ file, chapterId, title, notifyStudents, sortOrder, localDuration });
        setStatus('uploading');
      } catch (err) {
        setError(err.message); setStatus('error'); onError?.(err); return;
      }
    }

    setCurrentVideoId(sessionData.bunnyVideoId);
    lastOptsRef.current = { file, sessionData, localDuration, chapterId, title, notifyStudents, sortOrder, onComplete, onError };

    await _uploadLoop({ file, sessionData, localDuration, onComplete, onError });
  }, []);

  const resume = useCallback(() => {
    const opts = lastOptsRef.current;
    if (!opts) return;

    // الكائن القديم ميت بالفعل (uploadRef.current = null في catch)
    uploadRef.current = null;
    cancelledRef.current = false;

    setError(null);
    setStatus('uploading');

    _uploadLoop({ ...opts });
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const current = uploadRef.current;
    uploadRef.current = null;
    if (current) { try { current.abort(); } catch (_) {} }
    setStatus('cancelled');
    setProgress(0);
  }, []);

  const reset = useCallback((file) => {
    cancelledRef.current = true;
    const current = uploadRef.current;
    uploadRef.current = null;
    if (current) { try { current.abort(); } catch (_) {} }
    if (file) { clearSession(file); clearTusInternalStorage(file); }
    lastOptsRef.current = null;
    setProgress(0); setStatus('idle'); setError(null); setCurrentVideoId(null);
  }, []);

  return { startUpload, cancel, reset, resume, progress, status, error, currentVideoId };
}
