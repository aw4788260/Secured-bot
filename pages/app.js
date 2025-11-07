// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function App() {
  const [status, setStatus] = useState('جاري التحقق من هويتك...');
  const [error, setError] = useState(null);
  
  // --- [ ✅ تغيير المسميات ] ---
  const [subjects, setSubjects] = useState([]); // (سابقاً courses)
  const [selectedSubject, setSelectedSubject] = useState(null); // (سابقاً selectedCourse)
  const [selectedChapter, setSelectedChapter] = useState(null); // (سابقاً selectedSection)
  // --- [ نهاية تغيير المسميات ] ---

  const [user, setUser] = useState(null);

  useEffect(() => {
    
    // (دالة مساعدة لجلب المواد بعد نجاح التحقق)
    const fetchSubjects = (userIdString, foundUser) => {
      // (نستخدم الـ API المعدل الذي يرجع المواد)
      fetch(`/api/data/get-structured-courses?userId=${userIdString}`)
        .then(res => {
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          return res.json();
        })
        .then(subjectsData => { // (البيانات الآن هي مواد)
          if (!Array.isArray(subjectsData)) {
            // (معالجة الأخطاء التي قد يرجعها ال API كـ JSON)
            throw new Error(subjectsData.message || 'Failed to load data structure');
          }
          setSubjects(subjectsData); // (نخزن المواد)
          setUser(foundUser); 
          setStatus(''); 
        })
        .catch(err => {
          setError(`حدث خطأ أثناء جلب المواد: ${err.message}`);
          console.error("Error fetching subjects:", err);
        });
    };

    // (دالة مساعدة للتحقق من البصمة وجلب المواد)
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
          setStatus('جاري جلب المواد...');
          const userIdString = String(userId);
          
          if (isAndroidApk) { 
            fetch(`/api/auth/get-user-name?userId=${userIdString}`)
              .then(res => res.json())
              .then(nameData => {
                const realUser = { id: userId, first_name: nameData.name };
                fetchSubjects(userIdString, realUser); // جلب المواد
              })
              .catch(err => {
                 const realUser = { id: userId, first_name: `User ${userId}` };
                 fetchSubjects(userIdString, realUser); // جلب المواد
              });
          } else {
              fetchSubjects(userIdString, foundUser); // جلب المواد
          }
        }
      })
      .catch(err => {
        setError('حدث خطأ أثناء التحقق من الجهاز.');
        console.error("Error checking device:", err);
      });
    };

    // (دالة التحقق من الاشتراك - تستخدم ال API المعدل)
    const checkSubscriptionAndDevice = (foundUser, isAndroidApk = false, deviceId = null) => {
      setStatus('جاري التحقق من الاشتراك...');
      fetch('/api/auth/check-subscription', { // (يستخدم ال API المعدل)
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

        setStatus('جاري التحقق من بصمة الجهاز...');
        if (isAndroidApk) {
          checkDeviceApi(foundUser.id, deviceId, foundUser, true);
        } else {
          // (تليجرام: استخدام بصمة المتصفح)
          const loadBrowserFingerprint = async () => {
            try {
              const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
              const fp = await FingerprintJS.load();
              const result = await fp.get();
              return result.visitorId;
            } catch (fpError) {
              console.error("FingerprintJS error:", fpError);
              // (خطة بديلة بسيطة إذا فشل FingerprintJS)
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


    // --- [ ✅ بداية المنطق الرئيسي للتحقق ] ---
    // (هذا الكود مأخوذ من ملفك الأصلي ويعمل كما هو)
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
        
        const platform = window.Telegram.WebApp.platform;
        const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
        
        if (!miniAppUser || !miniAppUser.id) {
            setError("لا يمكن التعرف على هويتك من تليجرام.");
            return;
        }
        
        console.log("Detected Telegram Platform:", platform);

        if (platform === 'ios' || platform === 'macos') { // (السماح للآيفون والماك)
          // [ الحالة 2أ: آيفون/ماك (سماح بالدخول) ]
          checkSubscriptionAndDevice(miniAppUser, false, null);
        
        } else {
          // [ الحالة 2ب: أندرويد أو ديسكتوب (يجب التحقق من الأدمن) ]
          setStatus('جاري التحقق من صلاحيات الأدمن...');
          
          fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
            .then(res => res.json())
            .then(adminData => {
                if (adminData.isAdmin) {
                    // (سماح بالدخول للأدمن)
                    console.log("Admin detected on non-ios platform. Allowing access.");
                    checkSubscriptionAndDevice(miniAppUser, false, null);
                } else {
                    // (منع الدخول لغير الأدمن)
                    setError('عذراً، الفتح من تليجرام متاح للآيفون والماك فقط. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                }
            })
            .catch(err => {
                setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
            });
        }

      // [ الحالة 3: مستخدم متصفح عادي (منع الدخول) ]
      } else if (typeof window !== 'undefined') {
        setError('الرجاء الفتح من البرنامج المخصص (للأندرويد) أو من تليجرام (للآيفون).');
        return;
      }
      
    } catch (e) { 
      console.error("Fatal error in useEffect:", e);
      setError(`خطأ فادح: ${e.message}`);
    }

  }, []); // نهاية useEffect

  // (الرسائل الأولية - مع إضافة مؤشر التحميل)
  // (هذا مأخوذ من ملف globals.css الخاص بك)
  const renderLoader = () => (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Head><title>جاري التحميل...</title></Head>
        <style jsx>{`
          .spinner {
            border: 4px solid rgba(255, 255, 255, 0.2);
            border-left-color: #38bdf8;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div className="spinner"></div>
        <h1>{status || 'جاري التحميل...'}</h1>
      </div>
  );

  if (error) {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status || !user) {
    return renderLoader();
  }

  // --- [ ✅ تغيير منطق العرض ] ---

  // (المستوى 3: عرض الفيديوهات - يتغير ليعتمد على selectedChapter)
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
                {/* (رابط صفحة المشاهدة لا يتغير) */}
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

  // (المستوى 2: عرض الشباتر/المجلدات - يتغير ليعتمد على selectedSubject)
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

  // (المستوى 1: عرض المواد - هذا هو المستوى الأول الجديد)
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
