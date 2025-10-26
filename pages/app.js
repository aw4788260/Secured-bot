// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const loadFingerprint = async () => {
  const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
};

export default function App() {
  const [status, setStatus] = useState('جاري التحقق من هويتك...');
  const [error, setError] = useState(null);
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // التأكد من أن الكود يعمل في المتصفح فقط
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;

      if (!tgUser) {
        setError('لا يمكن التعرف على هويتك. الرجاء الفتح من تليجرام.');
        return;
      }
      setUser(tgUser);
      setStatus('جاري التحقق من الاشتراك...'); // تحديث الحالة

      // --- الخطوة 1: التحقق من الاشتراك أولاً ---
      fetch('/api/auth/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tgUser.id }),
      })
      .then(res => res.json())
      .then(subData => {
        if (!subData.isSubscribed) {
          setError('أنت غير مشترك. الرجاء تفعيل اشتراكك أولاً.');
          return; // إيقاف التنفيذ إذا لم يكن مشتركاً
        }

        // --- الخطوة 2: التحقق من بصمة الجهاز (فقط إذا كان مشتركاً) ---
        setStatus('جاري التحقق من بصمة الجهاز...');
        loadFingerprint().then(fingerprint => {
          fetch('/api/auth/check-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tgUser.id, fingerprint: fingerprint }),
          })
          .then(res => res.json())
          .then(deviceData => {
            if (!deviceData.success) {
              setError(deviceData.message); // عرض رسالة الخطأ (مثل: جهاز آخر)
            } else {
              setStatus('جاري جلب الكورسات...');
              // --- الخطوة 3: جلب قائمة الفيديوهات (فقط إذا نجح كل شيء) ---
              fetch('/api/data/get-all-videos')
                .then(res => res.json())
                .then(videoData => {
                  setVideos(videoData);
                  setStatus(''); // إخفاء رسالة التحميل
                });
            }
          });
        });

      })
      .catch(err => {
         // معالجة أي خطأ عام في الشبكة
         setError('حدث خطأ أثناء التحقق. حاول مرة أخرى.');
         console.error(err);
      });

    } else if (typeof window !== 'undefined') {
      // هذا سيعمل إذا لم يتم تحميل السكريبت
      setError('الرجاء فتح التطبيق من داخل تليجرام.');
    }
  }, []);

  if (error) {
    return <div><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status) {
    return <div><Head><title>جاري التحميل</title></Head><h1>{status}</h1></div>;
  }

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial, sans-serif' }}>
      <Head><title>الكورسات</title></Head>
      <h1>الكورسات المتاحة</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {videos.map(video => (
          <li key={video.id} style={{ margin: '8px 0', fontSize: '1.2em' }}>
            <Link href={`/watch/${video.id}`}>
              <a style={{ textDecoration: 'none', color: '#007bff', padding: '10px', display: 'block', background: '#f0f0f0', borderRadius: '5px' }}>
                {video.title}
              </a>
            </Link>
          </li>
        ))}
      </ul>
      {user && <p style={{ color: '#888', fontSize: '12px', textAlign: 'center' }}>مرحباً, {user.first_name}</p>}
    </div>
  );
}
