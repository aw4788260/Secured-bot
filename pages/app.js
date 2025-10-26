// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// --- [هذا هو التعديل] ---
// قمنا بتعديل هذه الدالة لتجميع بصمة "مستقرة وفريدة"
const loadFingerprint = async () => {
  const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
  
  const fp = await FingerprintJS.load({
    monitoring: false 
  });

  // طلب المكونات الجديدة (المستقرة + الفريدة)
  const result = await fp.get({
    components: [
      // مكونات مستقرة (قد تتشابه بين جهازين نفس النوع)
      'platform',      // 1. نوع نظام التشغيل/الجهاز
      'vendorWebGL',   // 2. نوع كارت الشاشة (Vendor)
      'rendererWebGL', // 3. اسم كارت الشاشة (Renderer)
      
      // مكون مستقر وفريد (يختلف بناءً على التطبيقات المثبتة)
      'fonts'          // 4. قائمة الخطوط المثبتة
    ]
  });

  // نقوم بتجميع القيم في نص واحد لإنشاء البصمة
  const components = result.components;
  const stableFingerprint = JSON.stringify({
    p: components.platform.value,
    v: components.vendorWebGL.value,
    r: components.rendererWebGL.value,
    // (سنقوم بضغط قائمة الخطوط لتقليل حجم البصمة)
    f: components.fonts.value.map(font => font.family).join(',')
  });

  return stableFingerprint;
};
// --- [نهاية التعديل] ---


export default function App() {
  const [status, setStatus] = useState('جاري التحقق من هويتك...');
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;

      if (!tgUser || !tgUser.id) {
        setError('لا يمكن التعرف على هويتك. الرجاء الفتح من تليجرام.');
        return;
      }
      setUser(tgUser);
      setStatus('جاري التحقق من الاشتراك...');

      // --- الخطوة 1: التحقق من الاشتراك (كما هي) ---
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

        // --- الخطوة 2: التحقق من بصمة الجهاز (تستخدم الدالة المعدلة) ---
        setStatus('جاري التحقق من بصمة الجهاز...');
        loadFingerprint().then(fingerprint => { // <-- ستُرجع البصمة المستقرة
          fetch('/api/auth/check-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tgUser.id, fingerprint: fingerprint }),
          })
          .then(res => res.json())
          .then(deviceData => {
            if (!deviceData.success) {
              setError(deviceData.message);
            } else {
              setStatus('جاري جلب الكورسات...');
              
              const userIdString = String(tgUser.id);
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
        });

      })
      .catch(err => {
         setError('حدث خطأ أثناء التحقق. حاول مرة أخرى.');
         console.error(err);
      });

    } else if (typeof window !== 'undefined') {
      setError('الرجاء فتح التطبيق من داخل تليجرام.');
    }
  }, []);

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
