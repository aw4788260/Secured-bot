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
  
  // 1. [✅] حالة لتخزين بصمة الجهاز لاستخدامها في الروابط
  const [deviceId, setDeviceId] = useState(null);

  // (دالة جلب المواد - كما هي)
  const fetchSubjects = (userIdString, foundUser, urlSubjectId = null, urlMode = null) => {
    fetch(`/api/data/get-structured-courses?userId=${userIdString}`) 
      .then(res => res.json())
      .then(subjectsData => {
        if (!Array.isArray(subjectsData)) throw new Error(subjectsData.message || 'Failed to load data');
        
        setSubjects(subjectsData); 
        setUser(foundUser);
        
        if (urlSubjectId) {
            const subjectFromUrl = subjectsData.find(s => s.id == urlSubjectId);
            if (subjectFromUrl) {
                setSelectedSubject(subjectFromUrl);
                if (urlMode === 'exams') {
                    setMode('exams');
                }
            }
        }
        setStatus(null); 
      })
      .catch(err => {
        setError('حدث خطأ أثناء جلب المواد.');
        console.error("Error fetching subjects:", err);
      });
  };

  // (دالة فحص الجهاز - كما هي)
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
              fetchSubjects(userIdString, realUser, urlSubjectId, urlMode); 
            })
            .catch(err => {
               const realUser = { id: userId, first_name: `User ${userId}` };
               fetchSubjects(userIdString, realUser, urlSubjectId, urlMode); 
            });
        } else {
            fetchSubjects(userIdString, foundUser, urlSubjectId, urlMode); 
        }
      }
    })
    .catch(err => {
      setError('حدث خطأ أثناء التحقق من الجهاز.');
      console.error("Error checking device:", err);
    });
  };
  
  // (دالة فحص الاشتراك - كما هي)
  const checkSubscriptionAndDevice = (foundUser, isAndroidApk = false, androidId = null, urlSubjectId, urlMode) => {
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
        // هنا كان يتم الحفظ سابقاً للحالة الأولى فقط
        setDeviceId(androidId); 
        checkDeviceApi(foundUser.id, androidId, foundUser, true, urlSubjectId, urlMode); 
      } else {
        // ... (بصمة المتصفح) ...
        const loadBrowserFingerprint = async () => {
             try {
                 const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
                 const fp = await FingerprintJS.load();
                 const result = await fp.get();
                 return result.visitorId;
             } catch (e) { 
                 console.error("Fingerprint error:", e);
                 return `fallback_${navigator.userAgent.substring(0, 50)}`; 
             }
        };
        loadBrowserFingerprint().then(fingerprint => {
            setDeviceId(fingerprint); 
            checkDeviceApi(foundUser.id, fingerprint, foundUser, false, urlSubjectId, urlMode); 
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
      const urlParams = new URLSearchParams(window.location.search);
      const urlSubjectId = urlParams.get('subjectId');
      const urlMode = urlParams.get('mode');
      
      const androidUserId = urlParams.get('android_user_id');
      const androidDeviceId = urlParams.get('android_device_id'); 
      
      // المتغيرات عند العودة من صفحة أخرى (مثل صفحة النتائج)
      const genericUserId = urlParams.get('userId'); 
      const genericDeviceId = urlParams.get('deviceId'); // [✅] قراءة البصمة عند العودة

      // الحالة 1: مستخدم APK (أول دخول)
      if (androidUserId && androidUserId.trim() !== '') {
        console.log("Running in secure Android WebView wrapper");
        const apkUser = { id: androidUserId, first_name: "Loading..." }; 
        checkSubscriptionAndDevice(apkUser, true, androidDeviceId, urlSubjectId, urlMode);
      
      // الحالة 2: مستخدم عائد من صفحة النتائج أو الفيديو
      } else if (genericUserId && genericUserId.trim() !== '') {
        console.log("Running as navigated user");
        const navigatedUser = { id: genericUserId, first_name: "User" }; 
        
        // [✅✅ التعديل الجوهري هنا]
        // حفظ البصمة القادمة من الرابط في الـ State فوراً لضمان استمراريتها
        if (genericDeviceId) {
            setDeviceId(genericDeviceId);
        }

        fetch('/api/auth/check-subscription', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: navigatedUser.id }),
        })
        .then(res => res.json())
        .then(subData => {
            if (!subData.isSubscribed) {
                setError('أنت غير مشترك.');
                return;
            }
            // جلب المواد مباشرة
            fetchSubjects(navigatedUser.id.toString(), navigatedUser, urlSubjectId, urlMode);
        })
        .catch(err => {
           setError('حدث خطأ أثناء التحقق.');
           console.error("Check sub error:", err);
        });

      // الحالة 3: تليجرام
      } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
         window.Telegram.WebApp.ready();
         const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
         if(miniAppUser) {
             const platform = window.Telegram.WebApp.platform;
             console.log("Detected Telegram Platform:", platform);
             
             if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
                checkSubscriptionAndDevice(miniAppUser, false, null, urlSubjectId, urlMode);
             } else {
                // التحقق من الأدمن للمنصات الأخرى
                fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
                    .then(res => res.json())
                    .then(adminData => {
                        if (adminData.isAdmin) {
                            checkSubscriptionAndDevice(miniAppUser, false, null, urlSubjectId, urlMode);
                        } else {
                            setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                        }
                    }).catch(() => setError('فشل التحقق من الأدمن'));
             }
         } else {
             setError("خطأ: لا يمكن التعرف على المستخدم من تليجرام.");
         }
      } else if (typeof window !== 'undefined') {
        setError('الرجاء الفتح من التطبيق المخصص.');
        return;
      }
      
    } catch (e) { 
      setError(`خطأ فادح: ${e.message}`);
      console.error(e);
    }

  }, []); 

  // ... (شاشات التحميل والخطأ) ...
  if (error) return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  if (status || !user) return <div className="app-container loader-container"><h1>{status}</h1></div>;

  // --- العرض (Render) ---
  
  // [✅] دالة مساعدة لبناء الرابط مع البصمة
  // تضمن أن البصمة موجودة دائماً في الروابط حتى لو كانت الحالة فارغة (تأخذها من الرابط الحالي)
  const getLinkWithParams = (path) => {
      const finalDeviceId = deviceId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('deviceId') : '');
      return `${path}?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}&deviceId=${finalDeviceId}`;
  };

  // المستوى 3: الفيديوهات
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        <button className="back-button" onClick={() => setSelectedChapter(null)}>
          &larr; رجوع
        </button>
        <h1>{selectedChapter.title}</h1>
        <ul className="item-list">
          {selectedChapter.videos.length > 0 ? (
            selectedChapter.videos.map(video => {
              let href = '';
              let icon = '▶️';
              let linkClassName = 'button-link';

              if (video.type === 'telegram-video') {
                  href = getLinkWithParams(`/stream/${video.id}`);
                  linkClassName += ' video-link';
                  icon = '🎥';
              } else if (video.type === 'pdf') {
                  href = getLinkWithParams(`/view/${video.id}`);
                  icon = '📄';
              } else {
                  // يوتيوب
                  href = getLinkWithParams(`/watch/${video.id}`);
                  linkClassName += ' video-link';
              }
              
              return (
                <li key={video.id}>
                  <Link href={href}>
                    <a className={linkClassName}>{icon} {video.title}</a>
                  </Link>
                </li>
              );
            })
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

  // المستوى 2: الشباتر والامتحانات
  if (selectedSubject) {
    // ... (اختيار الوضع) ...
    if (mode === null) {
        return (
            <div className="app-container">
                <Head><title>{selectedSubject.title}</title></Head>
                <button className="back-button" onClick={() => setSelectedSubject(null)}>&larr; رجوع للمواد</button>
                <h1>{selectedSubject.title}</h1>
                <p style={{ color: '#aaa', textAlign: 'right', marginBottom: '20px' }}>اختر القسم الذي تريده:</p>
                <ul className="item-list">
                    <li><button className="button-link" onClick={() => setMode('lectures')}>📁 الشرح <span>({selectedSubject.chapters.length} شابتر)</span></button></li>
                    <li><button className="button-link" onClick={() => setMode('exams')}>✏️ الامتحانات</button></li>
                </ul>
                <footer className="developer-info">
                    <p>برمجة وتطوير: A7MeD WaLiD</p>
                    <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
                </footer>
            </div>
        );
    }

    if (mode === 'lectures') {
        // ... (قائمة الشباتر) ...
        return (
            <div className="app-container">
                <Head><title>{selectedSubject.title} - الشرح</title></Head>
                <button className="back-button" onClick={() => setMode(null)}>&larr; رجوع</button>
                <h1>{selectedSubject.title}</h1>
                <ul className="item-list">
                    {selectedSubject.chapters.length > 0 ? (
                        selectedSubject.chapters.map(ch => (
                            <li key={ch.id}>
                                <button className="button-link" onClick={() => setSelectedChapter(ch)}>
                                    📁 {ch.title} <span>({ch.videos.length} ملف)</span>
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

    if (mode === 'exams') {
      const exams = selectedSubject.exams || []; 
      return (
        <div className="app-container">
          <Head><title>الامتحانات</title></Head>
          <button className="back-button" onClick={() => setMode(null)}>&larr; رجوع</button>
          <h1>الامتحانات المتاحة</h1>
          <ul className="item-list">
            {exams.length > 0 ? (
              exams.map(exam => {
                
                let href = '';
                // [✅] استخدام deviceId في روابط الامتحانات
                const finalDeviceId = deviceId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('deviceId') : '');
                const params = `?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}&subjectId=${selectedSubject.id}&deviceId=${finalDeviceId}`;
                
                if (!exam.is_completed) href = `/exam/${exam.id}${params}`;
                else href = `/results/${exam.first_attempt_id}${params}`;
                
                const examTitle = `✏️ ${exam.title} ${exam.is_completed ? '✅' : ''}`;

                return (
                  <li key={exam.id}>
                    <Link href={href}>
                      <a className="button-link">{examTitle}</a>
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

  // المستوى 1: المواد
  return (
    <div className="app-container">
      <Head><title>المواد المتاحة</title></Head>
      <h1>المواد المتاحة</h1>
      <ul className="item-list">
        {subjects.length > 0 ? (
            subjects.map(subject => (
                <li key={subject.id}>
                <button className="button-link" onClick={() => { setSelectedSubject(subject); setMode(null); }}>
                    📚 {subject.title} <span>({subject.chapters.length} شابتر)</span>
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
