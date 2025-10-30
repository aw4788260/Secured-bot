// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function App() {
  const [status, setStatus] = useState('جاري التحقق من هويتك...');
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);

  // --- [ ✅✅ حالة جديدة للمجلدات ] ---
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  
  // (دالة useEffect تبقى كما هي تماماً، فهي لا تحتاج تعديل)
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
        tgUser = { id: androidUserId, first_name: "App User" };
      } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      } else if (typeof window !== 'undefined') {
        setError('لا يمكن التعرف على هويتك. الرجاء الفتح من التطبيق المخصص أو من داخل تليجرام.');
        return;
      }

      // 3. التحقق من وجود المستخدم
      if (!tgUser || !tgUser.id) { 
        setError('لا يمكن التعرف على هويتك. (خطأ داخلي).');
        return;
      }
      
      setUser(tgUser);
      setStatus('جاري التحقق من الاشتراك...');

      // 4. دالة التحقق من البصمة وجلب الكورسات
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
              // جلب الكورسات بالهيكل الجديد
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

  // (الرسائل الأولية كما هي)
  if (error) {
    return <div className="app-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status) {
    return <div className="app-container"><Head><title>جاري التحميل</title></Head><h1>{status}</h1></div>;
  }

  // --- [ ✅✅ واجهة المستخدم الجديدة ثلاثية المستويات ] ---

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
                {/* تمرير بيانات المستخدم للرابط كما هي */}
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
        {user && <p className="user-greeting">مرحباً, {user.first_name}</p>}
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
        {user && <p className="user-greeting">مرحباً, {user.first_name}</p>}
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
      {user && <p className="user-greeting">مرحباً, {user.first_name}</p>}
    </div>
  );
}
