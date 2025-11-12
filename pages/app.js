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
  const [mode, setMode] = useState(null); 

  // --- [ 1. تعديل: الدالة ستقبل متغيرات من الرابط ] ---
  const fetchSubjects = (userIdString, foundUser, urlSubjectId = null, urlMode = null) => {
    fetch(`/api/data/get-structured-courses?userId=${userIdString}`) 
      .then(res => res.json())
      .then(subjectsData => {
        if (!Array.isArray(subjectsData)) throw new Error(subjectsData.message || 'Failed to load data');
        
        setSubjects(subjectsData); 
        setUser(foundUser);
        
        // --- [ 2. هذا هو الكود الجديد ] ---
        // (إذا جاء subjectId في الرابط، قم باختياره تلقائياً)
        if (urlSubjectId) {
            const subjectFromUrl = subjectsData.find(s => s.id == urlSubjectId);
            if (subjectFromUrl) {
                setSelectedSubject(subjectFromUrl);
                // (وإذا جاء "الوضع" في الرابط، قم بتعيينه)
                if (urlMode === 'exams') {
                    setMode('exams');
                }
            }
        }
        // --- [ نهاية الكود الجديد ] ---

        setStatus(null); // (إلغاء رسالة التحميل)
      })
      .catch(err => {
        setError('حدث خطأ أثناء جلب المواد.');
        console.error("Error fetching subjects:", err);
      });
  };

  // --- [ 3. تعديل: الدالة ستمرر متغيرات الرابط ] ---
  const checkDeviceApi = (userId, deviceFingerprint, foundUser, isAndroidApk, urlSubjectId, urlMode) => {
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
              fetchSubjects(userIdString, realUser, urlSubjectId, urlMode); // (تمرير)
            })
            .catch(err => {
               const realUser = { id: userId, first_name: `User ${userId}` };
               fetchSubjects(userIdString, realUser, urlSubjectId, urlMode); // (تمرير)
            });
        } else {
            fetchSubjects(userIdString, foundUser, urlSubjectId, urlMode); // (تمرير)
        }
      }
    })
    .catch(err => {
      setError('حدث خطأ أثناء التحقق من الجهاز.');
      console.error("Error checking device:", err);
    });
  };
  
  // (دالة checkSubscriptionAndDevice تبقى كما هي - ستمرر المتغيرات)
  const checkSubscriptionAndDevice = (foundUser, isAndroidApk = false, deviceId = null, urlSubjectId, urlMode) => {
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
        checkDeviceApi(foundUser.id, deviceId, foundUser, true, urlSubjectId, urlMode); // (تمرير)
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
            checkDeviceApi(foundUser.id, fingerprint, foundUser, false, urlSubjectId, urlMode); // (تمرير)
        });
      }
    })
    .catch(err => {
       setError('حدث خطأ أثناء التحقق من الاشتراك.');
       console.error("Error checking subscription:", err);
    });
  };


  useEffect(() => {
    try {
      // --- [ ✅✅ 4. هذا هو الإصلاح الجوهري ] ---
      const urlParams = new URLSearchParams(window.location.search);
      const urlSubjectId = urlParams.get('subjectId');
      const urlMode = urlParams.get('mode');
      
      // (نبحث عن أي معرّف هوية في الرابط)
      const androidUserId = urlParams.get('android_user_id');
      const genericUserId = urlParams.get('userId'); // (الذي ترسله صفحة النتائج)
      const androidDeviceId = urlParams.get('android_device_id'); 

      // (الحالة 1: مستخدم APK)
      if (androidUserId && androidUserId.trim() !== '') {
        console.log("Running in secure Android WebView wrapper");
        const apkUser = { id: androidUserId, first_name: "Loading..." }; 
        checkSubscriptionAndDevice(apkUser, true, androidDeviceId, urlSubjectId, urlMode);
      
      // (الحالة 2: مستخدم عائد من صفحة النتائج - يستخدم genericUserId)
      } else if (genericUserId && genericUserId.trim() !== '') {
        console.log("Running as navigated user (from results)");
        const navigatedUser = { id: genericUserId, first_name: "User" }; // (الاسم غير مهم هنا)
        // (لا نعتبره APK، ونمرر البيانات)
        checkSubscriptionAndDevice(navigatedUser, false, null, urlSubjectId, urlMode);

      // (الحالة 3: مستخدم تليجرام ميني آب)
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
        // (نمرر المتغيرات الجديدة)
        if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
          checkSubscriptionAndDevice(miniAppUser, false, null, urlSubjectId, urlMode);
        
        } else {
          fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
            .then(res => res.json())
            .then(adminData => {
                if (adminData.isAdmin) {
                    console.log("Admin detected on non-allowed platform. Allowing access.");
                    checkSubscriptionAndDevice(miniAppUser, false, null, urlSubjectId, urlMode); // (تمرير)
                } else {
                    setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                }
            })
            .catch(err => {
                setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
            });
        }

      // (الحالة 4: مستخدم متصفح عادي)
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

  // (المستوى 3: عرض الفيديوهات - يبقى كما هي)
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

  // (المستوى 2: اختيار الوضع أو عرض المحتوى)
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
                
                // (إضافة subjectId للرابط)
                let href = '';
                const baseParams = `?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}&subjectId=${selectedSubject.id}`;

                if (!exam.is_completed) {
                    href = `/exam/${exam.id}${baseParams}`;
                } else {
                    href = `/results/${exam.first_attempt_id}${baseParams}`;
                }
                  
                const examTitle = `✏️ ${exam.title} ${exam.is_completed ? '✅' : ''}`;
                // --- [ نهاية التعديل ] ---

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
              <button className="button-link" onClick={() => {
                  setSelectedSubject(subject);
                  setMode(null); // (إعادة تعيين الوضع عند اختيار مادة جديدة)
              }}>
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
