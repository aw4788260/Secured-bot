// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function App() {
  const [status, setStatus] = useState('جار فحص معلومات المستخدم...');
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [user, setUser] = useState(null);

  // ✅ 1. إضافة متغير الحالة الجديد
  const [mode, setMode] = useState(null); // (null, 'lectures', 'exams')

  useEffect(() => {
    
    const fetchSubjects = (userIdString, foundUser) => {
      fetch(`/api/data/get-structured-courses?userId=${userIdString}`) 
        .then(res => res.json())
        .then(subjectsData => {
          if (!Array.isArray(subjectsData)) throw new Error(subjectsData.message || 'Failed to load data');
          setSubjects(subjectsData); 
          setUser(foundUser);
          setStatus(null); 
        })
        .catch(err => {
          setError('حدث خطأ أثناء جلب المواد.');
          console.error("Error fetching subjects:", err);
        });
    };

    // (باقي كود useEffect كما هو ... من checkDeviceApi إلى نهاية منطق التحقق)
    // ...
    // (الكود من سطر 44 إلى 144 في ملفك الأصلي يبقى كما هو)
    // ...
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


    try {
      const urlParams = new URLSearchParams(window.location.search);
      const androidUserId = urlParams.get('android_user_id');
      const androidDeviceId = urlParams.get('android_device_id'); 

      if (androidUserId && androidUserId.trim() !== '') {
        console.log("Running in secure Android WebView wrapper");
        const apkUser = { id: androidUserId, first_name: "Loading..." }; 
        checkSubscriptionAndDevice(apkUser, true, androidDeviceId);

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

        if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
          checkSubscriptionAndDevice(miniAppUser, false, null);
        
        } else {
          fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
            .then(res => res.json())
            .then(adminData => {
                if (adminData.isAdmin) {
                    console.log("Admin detected on non-allowed platform. Allowing access.");
                    checkSubscriptionAndDevice(miniAppUser, false, null);
                } else {
                    setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                }
            })
            .catch(err => {
                setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
            });
        }

      } else if (typeof window !== 'undefined') {
        setError('الرجاء الفتح من البرنامج المخصص (للأندرويد) أو من تليجرام.');
        return;
      }
      
    } catch (e) { 
      console.error("Fatal error in useEffect:", e);
      setError(`خطأ فادح: ${e.message}`);
    }

  }, []); // نهاية useEffect

  // (شاشة التحميل والخطأ - تبقى كما هي)
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

  // (المستوى 3: عرض الفيديوهات - يبقى كما هو)
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

  // ✅ 2. التعديل الجوهري (المستوى 2: اختيار الوضع أو عرض المحتوى)
  if (selectedSubject) {
    
    // --- [ الحالة 2أ: المستخدم لم يختر الوضع بعد ] ---
    if (mode === null) {
      const exams = selectedSubject.exams || []; 
      
      return (
        <div className="app-container">
          <Head><title>{selectedSubject.title}</title></Head>
          <button className="back-button" onClick={() => setSelectedSubject(null)}>
            &larr; رجوع إلى المواد
          </button>
          <h1>{selectedSubject.title}</h1>
          <p style={{ color: '#aaa', textAlign: 'right', marginBottom: '20px' }}>اختر القسم الذي تريده:</p>
          <ul className="item-list">
            <li>
              <button className="button-link" onClick={() => setMode('lectures')}>
                📁 الشرح (الشباتر والفيديوهات)
                <span>({selectedSubject.chapters.length} شابتر)</span>
              </button>
            </li>
            <li>
              <button className="button-link" onClick={() => setMode('exams')}>
                ✏️ الامتحانات التفاعلية
                <span>({exams.length} امتحان)</span>
              </button>
            </li>
          </ul>
          <footer className="developer-info">
            <p>برمجة وتطوير: A7MeD WaLiD</p>
            <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
          </footer>
        </div>
      );
    }
    
    // --- [ الحالة 2ب: المستخدم اختار "الشرح" (lectures) ] ---
    if (mode === 'lectures') {
      return (
        <div className="app-container">
          <Head><title>{selectedSubject.title} - الشرح</title></Head>
          <button className="back-button" onClick={() => setMode(null)}>
            &larr; رجوع لاختيار القسم
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

    // --- [ الحالة 2ج: المستخدم اختار "الامتحانات" (exams) ] ---
    if (mode === 'exams') {
      const exams = selectedSubject.exams || []; 
      return (
        <div className="app-container">
          <Head><title>{selectedSubject.title} - الامتحانات</title></Head>
          <button className="back-button" onClick={() => setMode(null)}>
            &larr; رجوع لاختيار القسم
          </button>
          <h1>الامتحانات المتاحة</h1>
          <ul className="item-list">
            {exams.length > 0 ? (
              exams.map(exam => {
                
                // (هذا هو المنطق الذي طلبته لربط الزر)
                const href = exam.is_completed
                  ? `/results/${exam.last_attempt_id}?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}` // (اذهب للنتائج)
                  : `/exam/${exam.id}?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}`; // (اذهب للامتحان)
                  
                const examTitle = `✏️ ${exam.title} ${exam.is_completed ? '✅' : ''}`;

                return (
                  <li key={exam.id}>
                    <Link href={href}>
                      <a className="button-link"> 
                        {examTitle}
                      </a>
                    </Link>
                  </li>
                );
              })
            ) : (
              <p style={{ color: '#aaa' }}>لا توجد امتحانات في هذه المادة بعد.</p>
            )}
          </ul>
          <footer className="developer-info">
             <p>برمجة وتطوير: A7MeD WaLiD</p>
             <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
          </footer>
        </div>
      );
    }
  }


  // (المستوى 1: عرض المواد - يبقى كما هو)
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
