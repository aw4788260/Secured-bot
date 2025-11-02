// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function App() {
  const [status, setStatus] = useState('جاري التحقق من هويتك...');
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    
    // (دالة مساعدة لجلب الكورسات بعد نجاح التحقق)
    const fetchCourses = (userIdString, foundUser) => {
      fetch(`/api/data/get-structured-courses?userId=${userIdString}`) 
        .then(res => res.json())
        .then(courseData => {
          setCourses(courseData); 
          setUser(foundUser); // (تحديث الاسم بالاسم الحقيقي)
          setStatus(''); 
        })
        .catch(err => {
          setError('حدث خطأ أثناء جلب الكورسات.');
          console.error("Error fetching courses:", err);
        });
    };

    // (دالة مساعدة للتحقق من البصمة وجلب الكورسات)
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
          setStatus('جاري جلب الكورسات...');
          const userIdString = String(userId);
          
          if (isAndroidApk) { 
            // (جلب الاسم الحقيقي لمستخدم البرنامج)
            fetch(`/api/auth/get-user-name?userId=${userIdString}`)
              .then(res => res.json())
              .then(nameData => {
                const realUser = { id: userId, first_name: nameData.name };
                fetchCourses(userIdString, realUser); // جلب الكورسات بالاسم الحقيقي
              })
              .catch(err => {
                 const realUser = { id: userId, first_name: `User ${userId}` };
                 fetchCourses(userIdString, realUser); // جلب الكورسات بالاسم الافتراضي
              });
          } else {
              // (مستخدم تليجرام لديه الاسم بالفعل)
              fetchCourses(userIdString, foundUser);
          }
        }
      })
      .catch(err => {
        setError('حدث خطأ أثناء التحقق من الجهاز.');
        console.error("Error checking device:", err);
      });
    };

    // (دالة مساعدة للتحقق من الاشتراك ثم الجهاز)
    const checkSubscriptionAndDevice = (foundUser, isAndroidApk = false, deviceId = null) => {
      setStatus('جاري التحقق من الاشتراك...');
      fetch('/api/auth/check-subscription', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: foundUser.id }),
      })
      .then(res => res.json())
      .then(subData => {
        if (!subData.isSubscribed) {
          setError('أنت غير مشترك أو ليس لديك صلاحية لأي كورس.');
          return;
        }

        setStatus('جاري التحقق من بصمة الجهاز...');
        if (isAndroidApk) {
          // (برنامج APK: استخدام بصمة الجهاز)
          checkDeviceApi(foundUser.id, deviceId, foundUser, true);
        } else {
          // (تليجرام: استخدام بصمة المتصفح)
          const loadBrowserFingerprint = async () => {
            const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            return result.visitorId;
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


    // --- [ ✅✅ بداية المنطق الرئيسي للتحقق ] ---
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

        if (platform === 'ios') {
          // [ الحالة 2أ: آيفون (سماح بالدخول) ]
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
                    setError('عذراً، الفتح من تليجرام متاح للآيفون فقط. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
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
  if (error) {
    return <div className="app-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status || !user) { // (ننتظر تحميل الاسم)
    return (
      <div className="app-container loader-container">
        <Head><title>جاري التحميل...</title></Head>
        <div className="spinner"></div>
        <h1>{status || 'جاري التحميل...'}</h1>
      </div>
    );
  }

  // (المستوى 3: عرض الفيديوهات)
  if (selectedCourse && selectedSection) {
    return (
      <div className="app-container">
        <Head><title>{selectedSection.title}</title></Head>
        <button className="back-button" onClick={() => setSelectedSection(null)}>
          &larr; رجوع إلى مجلدات {selectedCourse.title}
        </button>
        <h1>{selectedSection.title}</h1>
        <ul className="item-list">
          {selectedSection.videos.length > 0 ? (
            selectedSection.videos.map(video => (
              <li key={video.id}>
                <Link href={`/watch/${video.id}?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}`}>
                  <a className="button-link video-link">
                    {video.title}
                  </a>
                </Link>
              </li>
            ))
          ) : (
            <p style={{ color: '#aaa' }}>لا توجد فيديوهات في هذا المجلد بعد.</p>
          )}
        </ul>        
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
          <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
        </footer>
      </div>
    );
  }

  // (المستوى 2: عرض المجلدات)
  if (selectedCourse) {
    return (
      <div className="app-container">
        <Head><title>{selectedCourse.title}</title></Head>
        <button className="back-button" onClick={() => setSelectedCourse(null)}>
          &larr; رجوع إلى الكورسات
        </button>
        <h1>{selectedCourse.title}</h1>
        <ul className="item-list">
          {selectedCourse.sections.length > 0 ? (
            selectedCourse.sections.map(section => (
              <li key={section.id}>
                <button className="button-link" onClick={() => setSelectedSection(section)}>
                  📁 {section.title}
                  <span>({section.videos.length} فيديو)</span>
                </button>
              </li>
            ))
          ) : (
            <p style={{ color: '#aaa' }}>لا توجد مجلدات في هذا الكورس بعد.</p>
          )}
        </ul>
        
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
          <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
        </footer>
      </div>
    );
  }

  // (المستوى 1: عرض الكورسات)
  return (
    <div className="app-container">
      <Head><title>الكورسات</title></Head>
      <h1>الكورسات المتاحة</h1>
      <ul className="item-list">
        {courses.length > 0 ? (
           courses.map(course => (
            <li key={course.id}>
              <button className="button-link" onClick={() => setSelectedCourse(course)}>
                📚 {course.title}
                <span>({course.sections.length} مجلد)</span>
              </button>
            </li>
           ))
        ) : (
           <p style={{ color: '#aaa' }}>لم يتم إسناد أي كورسات لك حتى الآن.</p>
        )}
      </ul>
      
      <footer className="developer-info">
        <p>برمجة وتطوير: A7MeD WaLiD</p>
        <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
      </footer>
    </div>
  );
}
