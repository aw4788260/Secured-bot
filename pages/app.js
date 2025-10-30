// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function App() {
  const [status, setStatus] = useState('جاري التحقق من هويتك...');
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try { 
      const urlParams = new URLSearchParams(window.location.search);
      const androidUserId = urlParams.get('android_user_id');
      const androidDeviceId = urlParams.get('android_device_id'); 
      
      let tgUser = null;

      // 2. سلسلة التحقق من الهوية (بترتيب معكوس وصحيح)
      if (androidUserId && androidUserId.trim() !== '') { 
        // --- [ ✅ هذا هو الإصلاح ] ---
        // الوضع 1: الفتح من تطبيق الأندرويد (نحول النص إلى رقم)
        console.log("Running in secure Android WebView wrapper");
        tgUser = { id: parseInt(androidUserId, 10) }; // <-- تحويل النص "123" إلى الرقم 123

      } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        // الوضع 2: الفتح من داخل تليجرام (يأتي كرقم افتراضياً)
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        
      } else if (typeof window !== 'undefined') {
        // الوضع 3: الفتح من متصفح عادي أو بـ ID فارغ
        setError('لا يمكن التعرف على هويتك. الرجاء الفتح من التطبيق المخصص أو من داخل تليجرام.');
        return; 
      }

      // التحقق من أن الرقم صالح
      if (!tgUser || !tgUser.id || isNaN(tgUser.id)) { 
        setError('لا يمكن التعرف على هويتك. (خطأ داخلي).');
        return;
      }
      
      setUser(tgUser); 
      setStatus('جاري التحقق من الاشتراك...');

      // 4. فصل دالة التحقق من البصمة
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

      // --- الخطوة 5: التحقق من الاشتراك (وجلب الاسم) ---
      fetch('/api/auth/check-subscription', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tgUser.id }), // <-- الآن نرسل رقماً صحيحاً
      })
      .then(res => res.json())
      .then(subData => {
        if (!subData.isSubscribed) {
          setError('أنت غير مشترك أو ليس لديك صلاحية لأي كورس.'); // <-- الخطأ الذي رأيته
          return;
        }

        // --- (تحديث المستخدم بالاسم الحقيقي) ---
        const finalUser = {
            id: tgUser.id,
            first_name: subData.first_name || (tgUser.first_name || "User")
        };
        setUser(finalUser); 

        // --- الخطوة 6: التحقق من بصمة الجهاز ---
        setStatus('جاري التحقق من بصمة الجهاز...');

        if (androidDeviceId) {
          checkDeviceApi(tgUser.id, androidDeviceId);
        } else {
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

  // (باقي الكود كما هو)
  if (error) {
    return <div className="app-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status) {
    return <div className="app-container"><Head><title>جاري التحميل</title></Head><h1>{status}</h1></div>;
  }

  if (!selectedCourse) {
    return (
      <div className="app-container">
        <Head><title>الكورسات</title></Head>
        <h1>الكورسات المتاحة</h1>
        <ul className="item-list">
          {courses.length > 0 ? (
             courses.map(course => (
              <li key={course.id}>
                <button className="button-link" onClick={() => setSelectedCourse(course)}>
                  {course.title}
                  <span>({course.videos.length} فيديو)</span>
                </button>
              </li>
             ))
          ) : (
             <p style={{ color: '#aaa' }}>لم يتم إسناد أي كورسات لك حتى الآن.</p>
          )}
        </ul>
        {user && <p className="user-greeting">مرحباً, {user.first_name}</p>}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Head><title>{selectedCourse.title}</title></Head>
      <button className="back-button" onClick={() => setSelectedCourse(null)}>
        &larr; رجوع إلى الكورسات
      </button>
      <h1>{selectedCourse.title}</h1>
      <ul className="item-list">
        {selectedCourse.videos.length > 0 ? (
          selectedCourse.videos.map(video => (
            <li key={video.id}>
              {/* (تمرير بيانات المستخدم للرابط) */}
              <Link href={`/watch/${video.id}?userId=${user.id}&firstName=${encodeURIComponent(user.first_name)}`}>
                <a className="button-link video-link">
                  {video.title}
                </a>
              </Link>
            </li>
          ))
        ) : (
          <p style={{ color: '#aaa' }}>لا توجد فيديوهات في هذا الكورس بعد.</p>
        )}
      </ul>
      {user && <p className="user-greeting">مرحباً, {user.first_name}</p>}
    </div>
  );
}
