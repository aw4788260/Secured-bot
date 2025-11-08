// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function App() {
  // [ ✅ تعديل: استخدام رسالة واحدة ثابتة ]
  const [status, setStatus] = useState('جار فحص معلومات المستخدم...');
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    
    const fetchSubjects = (userIdString, foundUser) => {
      fetch(`/api/data/get-structured-courses?userId=${userIdString}`) 
        .then(res => res.json())
        .then(subjectsData => {
          if (!Array.isArray(subjectsData)) throw new Error(subjectsData.message || 'Failed to load data');
          setSubjects(subjectsData); 
          setUser(foundUser);
          setStatus(null); // (إلغاء رسالة التحميل)
        })
        .catch(err => {
          setError('حدث خطأ أثناء جلب المواد.');
          console.error("Error fetching subjects:", err);
        });
    };

    const checkDeviceApi = (userId, deviceFingerprint, foundUser, isAndroidApk) => {
      fetch('/api/auth/check-device', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, fingerprint: deviceFingerprint }),
      })
      .then(res => res.json())
      .then(deviceData => {
        if (!deviceData.success) {
          setError(deviceData.message);
        } else {
          // [ 🛑 حذف: setStatus ]
          const userIdString = String(userId);
          
          if (isAndroidApk) { 
            fetch(`/api/auth/get-user-name?userId=${userIdString}`)
              .then(res => res.json())
              .then(nameData => {
                const realUser = { id: userId, first_name: nameData.name };
                fetchSubjects(userIdString, realUser);
              })
              .catch(err => {
                 const realUser = { id: userId, first_name: `User ${userId}` };
                 fetchSubjects(userIdString, realUser);
              });
          } else {
              fetchSubjects(userIdString, foundUser);
          }
        }
      })
      .catch(err => {
        setError('حدث خطأ أثناء التحقق من الجهاز.');
        console.error("Error checking device:", err);
      });
    };

    const checkSubscriptionAndDevice = (foundUser, isAndroidApk = false, deviceId = null) => {
      // [ 🛑 حذف: setStatus ]
      fetch('/api/auth/check-subscription', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: foundUser.id }),
      })
      .then(res => res.json())
      .then(subData => {
        if (!subData.isSubscribed) {
          setError('أنت غير مشترك أو ليس لديك صلاحية لأي مادة.');
          return;
        }

        // [ 🛑 حذف: setStatus ]
        if (isAndroidApk) {
          checkDeviceApi(foundUser.id, deviceId, foundUser, true);
        } else {
          const loadBrowserFingerprint = async () => {
            try {
              const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
              const fp = await FingerprintJS.load();
              const result = await fp.get();
              return result.visitorId;
            } catch (fpError) {
               console.error("FingerprintJS error:", fpError);
               return `fallback_${navigator.userAgent.substring(0, 50)}`;
            }
          };
          loadBrowserFingerprint().then(fingerprint => {
              checkDeviceApi(foundUser.id, fingerprint, foundUser, false);
          });
        }
      })
      .catch(err => {
         setError('حدث خطأ أثناء التحقق من الاشتراك.');
         console.error("Error checking subscription:", err);
      });
    };


    // --- [ ✅✅ بداية المنطق الرئيسي للتحقق (المعدل) ] ---
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const androidUserId = urlParams.get('android_user_id');
      const androidDeviceId = urlParams.get('android_device_id'); 

      // [ الحالة 1: مستخدم البرنامج (APK) ]
      if (androidUserId && androidUserId.trim() !== '') {
        console.log("Running in secure Android WebView wrapper");
        const apkUser = { id: androidUserId, first_name: "Loading..." }; 
        checkSubscriptionAndDevice(apkUser, true, androidDeviceId);

      // [ الحالة 2: مستخدم تليجرام ميني آب ]
      } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        
        const platform = window.Telegram.WebApp.platform; // (e.g., 'ios', 'android', 'macos', 'tdesktop')
        const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
        
        if (!miniAppUser || !miniAppUser.id) {
            setError("لا يمكن التعرف على هويتك من تليجرام.");
            return;
        }
        
        console.log("Detected Telegram Platform:", platform);

        // [ ✅ تعديل: السماح لـ (iOS, macOS, tdesktop) مباشرة ]
        if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
          // (سماح بالدخول للآيفون، الماك، والويندوز/لينكس ديسكتوب)
          checkSubscriptionAndDevice(miniAppUser, false, null);
        
        } else {
          // [ الحالة 2ب: المنصات الأخرى (مثل android, web) يجب التحقق من الأدمن ]
          // [ 🛑 حذف: setStatus ]
          
          fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
            .then(res => res.json())
            .then(adminData => {
                if (adminData.isAdmin) {
                    // (سماح بالدخول للأدمن على أي منصة)
                    console.log("Admin detected on non-allowed platform. Allowing access.");
                    checkSubscriptionAndDevice(miniAppUser, false, null);
                } else {
                    // (منع الدخول لغير الأدمن على هذه المنصات)
                    setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                }
            })
            .catch(err => {
                setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
            });
        }

      // [ الحالة 3: مستخدم متصفح عادي (منع الدخول) ]
      } else if (typeof window !== 'undefined') {
        setError('الرجاء الفتح من البرنامج المخصص (للأندرويد) أو من تليجرام.');
        return;
      }
      
    } catch (e) { 
      console.error("Fatal error in useEffect:", e);
      setError(`خطأ فادح: ${e.message}`);
    }

  }, []); // نهاية useEffect

  // [ ✅ تعديل: شاشة التحميل الجديدة ]
  if (error) {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status || !user) {
    return (
      <div className="app-container loader-container">
        <Head><title>جاري التحميل...</title></Head>
        <h1>{status}</h1>
        <div className="loading-bar"></div>
      </div>
    );
  }

  // (المستوى 3: عرض الفيديوهات)
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        <button className="back-button" onClick={() => setSelectedChapter(null)}>
          &larr; رجوع إلى شباتر {selectedSubject.title}
        </button>
        <h1>{selectedChapter.title}</h1>
        <ul className="item-list">
          {selectedChapter.videos.length > 0 ? (
            selectedChapter.videos.map(video => (
              <li key={video.id}>
                <Link href={`/watch/${video.id}?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}`}>
                  <a className="button-link video-link">
                    {video.title}
                  </a>
                </Link>
              </li>
            ))
          ) : (
            <p style={{ color: '#aaa' }}>لا توجد فيديوهات في هذا الشابتر بعد.</p>
          )}
        </ul>        
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
          <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
        </footer>
      </div>
    );
  }

  // (المستوى 2: عرض الشباتر/المجلدات)
  if (selectedSubject) {
    return (
      <div className="app-container">
        <Head><title>{selectedSubject.title}</title></Head>
        <button className="back-button" onClick={() => setSelectedSubject(null)}>
          &larr; رجوع إلى المواد
        </button>
        <h1>{selectedSubject.title}</h1>
        <ul className="item-list">
          {selectedSubject.chapters.length > 0 ? (
            selectedSubject.chapters.map(chapter => (
              <li key={chapter.id}>
                <button className="button-link" onClick={() => setSelectedChapter(chapter)}>
                  📁 {chapter.title}
                  <span>({chapter.videos.length} فيديو)</span>
                </button>
              </li>
            ))
          ) : (
            <p style={{ color: '#aaa' }}>لا توجد شباتر في هذه المادة بعد.</p>
          )}
        </ul>
        
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
          <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
        </footer>
      </div>
    );
  }

  // (المستوى 1: عرض المواد)
  return (
    <div className="app-container">
      <Head><title>المواد المتاحة</title></Head>
      <h1>المواد المتاحة</h1>
      <ul className="item-list">
        {subjects.length > 0 ? (
           subjects.map(subject => (
            <li key={subject.id}>
              <button className="button-link" onClick={() => setSelectedSubject(subject)}>
                📚 {subject.title} 
                <span>({subject.chapters.length} شابتر)</span>
              </button>
            </li>
           ))
        ) : (
           <p style={{ color: '#aaa' }}>لم يتم إسناد أي مواد لك حتى الآن.</p>
        )}
      </ul>
      
      <footer className="developer-info">
         <p>برمجة وتطوير: A7MeD WaLiD</p>
         <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
      </footer>
    </div>
  );
}
