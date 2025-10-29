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
    // 1. قراءة البارامترات من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const androidUserId = urlParams.get('android_user_id');
    const androidDeviceId = urlParams.get('android_device_id'); 
    
    let tgUser = null;

    // --- [هذا هو الإصلاح] ---
    // 2. سلسلة التحقق من الهوية (تم إعادة ترتيبها)
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      // الوضع 1: الفتح من داخل تليجرام
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      
    } else if (androidUserId) {
      // الوضع 2: الفتح من تطبيق الأندرويد
      console.log("Running in secure Android WebView wrapper");
      tgUser = { id: androidUserId, first_name: "App User" };

    } else if (typeof window !== 'undefined') {
      // الوضع 3: الفتح من متصفح عادي (هذا هو الشرط الذي كان في غير مكانه)
      setError('لا يمكن التعرف على هويتك. الرجاء الفتح من التطبيق المخصص أو من داخل تليجرام.');
      return; // نوقف التنفيذ
    }
    // --- [نهاية الإصلاح] ---


    // 3. التحقق من وجود المستخدم
    if (!tgUser || !tgUser.id) { 
      setError('لا يمكن التعرف على هويتك. (خطأ داخلي).');
      return;
    }
    
    setUser(tgUser);
    setStatus('جاري التحقق من الاشتراك...');

    // 4. فصل دالة التحقق من البصمة (يجب تعريفها قبل استدعائها)
    const checkDeviceApi = (userId, deviceFingerprint) => {
        fetch('/api/auth/check-device', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, fingerprint: deviceFingerprint }),
        })
        .then(res => res.json())
        .then(deviceData => {
          if (!deviceData.success) {
            setError(deviceData.message); // "تم ربط هذا الحساب بجهاز آخر"
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
              });
          }
        });
    }

    // --- الخطوة 5: التحقق من الاشتراك ---
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

      // --- الخطوة 6: التحقق من بصمة الجهاز ---
      setStatus('جاري التحقق من بصمة الجهاز...');

      if (androidDeviceId) {
        // --- نحن في تطبيق الأندرويد ---
        checkDeviceApi(tgUser.id, androidDeviceId);
      } else {
        // --- نحن في تليجرام ويب (كوضع احتياطي أو للأدمن) ---
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
       setError('حدث خطأ أثناء التحقق. حاول مرة أخرى.');
       console.error(err);
    });

  }, []); // نهاية useEffect

  // ... (باقي كود الـ return كما هو) ...
  if (error) {
    return <div className="app-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status) {
    return <div className="app-container"><Head><title>جاري التحميل</title></Head><h1>{status}</h1></div>;
  }

  // --- العرض (كما هو) ---
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
              <Link href={`/watch/${video.id}`}>
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

