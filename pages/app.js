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
    try {
      // 1. قراءة البارامترات
      const urlParams = new URLSearchParams(window.location.search);
      const androidUserId = urlParams.get('android_user_id');
      const androidDeviceId = urlParams.get('android_device_id'); 
      let tgUser = null;

      // 2. سلسلة التحقق
      if (androidUserId && androidUserId.trim() !== '') {
        console.log("Running in secure Android WebView wrapper");
        // [ ✅✅ تعديل: لا نضع اسم افتراضي هنا ]
        tgUser = { id: androidUserId, first_name: "Loading..." }; // اسم مؤقت

      } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        
      } else if (typeof window !== 'undefined') {
        setError('لا يمكن التعرف على هويتك. الرجاء الفتح من التطبيق المخصص أو من داخل تليجرام.');
        return;
      }

      if (!tgUser || !tgUser.id) { 
        setError('لا يمكن التعرف على هويتك. (خطأ داخلي).');
        return;
      }
      
      setUser(tgUser); // وضع المستخدم (بالاسم المؤقت أو اسم تليجرام)
      setStatus('جاري التحقق من الاشتراك...');

      // 3. دالة التحقق من البصمة وجلب الكورسات
      const checkDeviceApi = (userId, deviceFingerprint) => {
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
              
              // [ ✅✅ جديد: جلب الاسم الحقيقي بالتوازي مع الكورسات ]
              if (androidUserId) { // (فقط إذا كنا داخل الأندرويد)
                fetch(`/api/auth/get-user-name?userId=${userIdString}`)
                  .then(res => res.json())
                  .then(nameData => {
                    // تحديث اسم المستخدم بالاسم الحقيقي
                    setUser({ id: userId, first_name: nameData.name });
                  })
                  .catch(err => {
                    // (إذا فشل، نستخدم اسم افتراضي)
                    console.error("Error fetching user name:", err);
                     setUser({ id: userId, first_name: `User ${userId}` });
                  });
              } else if (tgUser) {
                  // (إذا كنا في تليجرام ويب، الاسم موجود لدينا بالفعل)
                  setUser(tgUser);
              }

              // (الكود الأصلي لجلب الكورسات بالهيكل الهرمي)
              fetch(`/api/data/get-structured-courses?userId=${userIdString}`) 
                .then(res => res.json())
                .then(courseData => {
                  setCourses(courseData); 
                  setStatus(''); 
                })
                .catch(err => {
                  setError('حدث خطأ أثناء جلب الكورسات.');
                  console.error("Error fetching courses:", err);
                });
            }
          })
          .catch(err => {
            setError('حدث خطأ أثناء التحقق من الجهاز.');
            console.error("Error checking device:", err);
          });
      }

      // 4. التحقق من الاشتراك
      fetch('/api/auth/check-subscription', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tgUser.id }),
      })
      .then(res => res.json())
      .then(subData => {
        if (!subData.isSubscribed) {
          setError('أنت غير مشترك أو ليس لديك صلاحية لأي كورس.');
          return;
        }

        // 5. التحقق من بصمة الجهاز
        setStatus('جاري التحقق من بصمة الجهاز...');
        if (androidDeviceId) {
          checkDeviceApi(tgUser.id, androidDeviceId);
        } else {
          // (الوضع الاحتياطي للمتصفح العادي)
          const loadBrowserFingerprint = async () => {
            const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            return result.visitorId;
          };
          loadBrowserFingerprint().then(fingerprint => {
              checkDeviceApi(tgUser.id, fingerprint);
          });
        }
      })
      .catch(err => {
         setError('حدث خطأ أثناء التحقق من الاشتراك.');
         console.error("Error checking subscription:", err);
      });

    } catch (e) { 
      console.error("Fatal error in useEffect:", e);
      setError(`خطأ فادح: ${e.message}`);
    }

  }, []); // نهاية useEffect

  // (الرسائل الأولية)
  
// (الرسائل الأولية)
  if (error) {
    return <div className="app-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status || !user || user.first_name === "Loading...") { // (ننتظر تحميل الاسم)
    return <div className="app-container"><Head><title>جاري التحميل</title></Head><h1>{status}</h1></div>;
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
                {/* [ ✅ إصلاح: الآن سيتم تمرير الاسم الحقيقي ] */}
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
        
        
        {/* --- [ ✅ إضافة معلومات المبرمج ] --- */}
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
          <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
        </footer>
        {/* --- [ نهاية الإضافة ] --- */}
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
        
        
        {/* --- [ ✅ إضافة معلومات المبرمج ] --- */}
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
          <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
        </footer>
        {/* --- [ نهاية الإضافة ] --- */}
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
      
      
      {/* --- [ ✅ إضافة معلومات المبرمج ] --- */}
      <footer className="developer-info">
        <p>برمجة وتطوير: A7MeD WaLiD</p>
        <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
      </footer>
      {/* --- [ نهاية الإضافة ] --- */}
    </div>
  );
              }
