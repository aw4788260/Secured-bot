// hooks/useBunnyDirectUpload.js
// ===================================================================
// 🎯 Hook للرفع المباشر من جهاز المعلم إلى Bunny Stream (بدون المرور بالسيرفر)
// ===================================================================
//
// ✅ منطق الاستئناف عند انقطاع الإنترنت (مطابق لتوصية Bunny الرسمية):
//   - عند إنشاء جلسة رفع جديدة، تُحفظ بيانات الجلسة الخاصة بنا (bunnyVideoId,
//     signature, expiresAt, libraryId, chapterId, title, duration, sortOrder,
//     notifyStudents) في localStorage بمفتاح مرتبط ببصمة الملف، لأن مكتبة
//     tus-js-client لا تعرف عن هذه البيانات أصلاً (هي بيانات تخص تطبيقنا).
//   - ⚠️ المحاولة السابقة كانت تمرر uploadUrl يدوياً (مأخوذ من upload.url بعد
//     onUploadUrlAvailable). هذا تسبب في توقّف الرفع عند 0% بعد الاستئناف:
//     طلب HEAD الذي ترسله _resumeUpload() كان يفشل بخطأ "missing offset value"
//     (الهيدر Upload-Offset غير مكشوف عبر CORS من نقطة Bunny في بعض الحالات)،
//     ثم تعيد المكتبة المحاولة داخلياً (retryDelays) بلا توقف ظاهري — أي تبدو
//     "متوقفة عند 0%" بينما هي فعلياً تعيد إرسال نفس HEAD الفاشل مراراً.
//   - ✅ الحل الصحيح وهو ما توصي به Bunny رسمياً في وثائقها: استخدام آلية
//     tus-js-client المدمجة via findPreviousUploads()/resumeFromPreviousUpload()
//     بدلاً من تمرير uploadUrl يدوياً. هذه الآلية تستخدم تخزينها الداخلي
//     الخاص (WebStorageUrlStorage في localStorage تحت مفاتيح "tus::...")
//     المُختبر من Bunny نفسها مع نقطة tusupload، وتتعامل تلقائياً مع كل
//     حالات إعادة المحاولة دون أي تدخل يدوي من جهتنا.
//   - عند اكتمال الرفع بنجاح، تُحذف بيانات جلستنا الخاصة من localStorage
//     (تخزين tus-js-client الداخلي يُنظَّف تلقائياً بواسطة المكتبة نفسها).
//   - عند الإلغاء اليدوي من المعلم، تُحذف بيانات جلستنا الخاصة أيضاً.
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
 * يُستخدم لربط الجلسة المحفوظة بنفس الملف عند إعادة المحاولة
 */
function getFileFingerprint(file) {
  return `bunny-session:${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * حفظ بيانات الجلسة في localStorage مرتبطةً ببصمة الملف
 */
function saveSession(file, data) {
  try {
    localStorage.setItem(getFileFingerprint(file), JSON.stringify(data));
  } catch (_) {}
}

/**
 * استرجاع جلسة محفوظة مسبقاً لنفس الملف (إن وُجدت وكانت صالحة)
 * الجلسة تنتهي صلاحيتها عند انتهاء expiresAt (وقت التوقيع)
 */
function loadSession(file) {
  try {
    const raw = localStorage.getItem(getFileFingerprint(file));
    if (!raw) return null;
    const session = JSON.parse(raw);
    // التحقق من صلاحية التوقيع — إذا انتهت نحذف الجلسة
    if (session.expiresAt && Date.now() / 1000 > session.expiresAt - 60) {
      localStorage.removeItem(getFileFingerprint(file));
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

/**
 * حذف الجلسة المحفوظة لملف معين
 */
function clearSession(file) {
  try {
    localStorage.removeItem(getFileFingerprint(file));
  } catch (_) {}
}

/**
 * حذف أي إدخال متبقٍ في تخزين tus-js-client الداخلي الخاص بنفس الملف
 * (يُستخدم فقط عند reset كامل ومتعمَّد، لمنع استئناف غير مقصود لاحقاً)
 */
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

/**
 * 👈 دالة متطورة لاستخراج مدة الفيديو محلياً من المتصفح
 * تعالج مشكلة (Infinity Bug) في متصفحات كروم عبر حدث 'seeked' بدلاً من 'ontimeupdate'
 * مع مهلة احتياطية (10 ثواني) لتجنب الانتظار اللانهائي
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
      // ✅ جلسة محفوظة موجودة — نستأنف بدون الاتصال بالسيرفر
      console.log('♻️ Resuming existing upload session for bunnyVideoId=', sessionData.bunnyVideoId);
      setStatus('uploading');
      // نستخدم duration المحفوظة في الجلسة إذا لم نحصل عليها الآن
      if (localDuration <= 0 && sessionData.localDuration > 0) {
        localDuration = sessionData.localDuration;
      }
    } else {
      // 🆕 لا توجد جلسة — ننشئ واحدة جديدة
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

        // ✅ حفظ الجلسة في localStorage حتى يمكن استئنافها لاحقاً
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

    // ── الخطوة 2: الرفع المباشر إلى Bunny عبر TUS ──────────────────
    try {
      const tus = await loadTus();

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: 'https://video.bunnycdn.com/tusupload',

          // ✅ إعادة المحاولة تلقائياً عند انقطاع الإنترنت
          //   المجموع الكلي ~9 دقائق من إعادة المحاولة قبل الاستسلام
          retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000, 60000, 60000],

          chunkSize: 50 * 1024 * 1024,

          // ✅ تنظيف تخزين tus-js-client الداخلي تلقائياً بعد اكتمال الرفع بنجاح
          //   (بدون هذا، تتراكم سجلات قديمة في localStorage لكل فيديو تم رفعه)
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
            // ✅ تنظيف بيانات جلستنا الخاصة من localStorage
            //   (تخزين tus-js-client الداخلي يُنظَّف تلقائياً بواسطة المكتبة)
            clearSession(file);
            resolve();
          },
        });

        uploadRef.current = upload;

        // ✅ الطريقة الرسمية الموصى بها من Bunny للاستئناف: نسأل tus-js-client
        //   نفسها (عبر تخزينها الداخلي المرتبط ببصمة الملف) إن كان هناك رفع
        //   سابق لم يكتمل لهذا الملف بالتحديد، ونستأنفه عبر resumeFromPreviousUpload
        //   قبل استدعاء start(). هذا يضمن أن المكتبة تتعرف فعلياً على رابط
        //   الرفع و offset الصحيح، بعكس تمرير uploadUrl يدوياً.
        upload.findPreviousUploads().then((previousUploads) => {
          if (previousUploads.length > 0) {
            // إذا وُجد أكثر من رفع سابق لنفس الملف (نادر)، نختار الأحدث منها
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
          // إذا فشل البحث عن رفع سابق (نادر) — نبدأ رفعاً عادياً بدلاً من تعليق الواجهة
          console.warn('⚠️ findPreviousUploads failed, starting fresh upload', err);
          upload.start();
        });
      });
    } catch (err) {
      if (err?.message === 'CANCELLED') {
        setStatus('cancelled');
        return;
      }
      // ✅ الرفع فشل بعد استنفاد كل المحاولات — نُبقي الجلسة في localStorage
      //   حتى يتمكن المعلم من استئنافها لاحقاً بمجرد الضغط على رفع مرة أخرى
      setError('انقطع الاتصال — اضغط رفع مرة أخرى لاستئناف من نقطة التوقف');
      setStatus('error');
      onError?.(err);
      return;
    }

    // ── الخطوة 3: تأكيد الحفظ في قاعدة البيانات ────────────────────
    setStatus('confirming');
    setProgress(100);

    // نستخدم البيانات من الجلسة المحفوظة (مهم في حالة الاستئناف بعد إغلاق الصفحة)
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
  }, []);

  const cancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setStatus('cancelled');
    setProgress(0);
    // ملاحظة: لا نحذف الجلسة هنا — الإلغاء اليدوي يحدث من زر الإلغاء
    // وقد يريد المعلم الاستئناف لاحقاً. clearSession يُستدعى فقط من reset()
  }, []);

  const reset = useCallback((file) => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    // ✅ عند reset الكامل (مثلاً بعد إلغاء مقصود) نحذف الجلسة المحفوظة
    //   الخاصة بنا، وأيضاً سجل الاستئناف الداخلي لمكتبة tus-js-client،
    //   حتى لا يحاول الرفع التالي لنفس الملف الاستئناف من نقطة قديمة عن طريق الخطأ
    if (file) {
      clearSession(file);
      clearTusInternalStorage(file);
    }
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
