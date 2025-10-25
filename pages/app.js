// pages/app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// دالة تحميل البصمة (تبقى كما هي)
const loadFingerprint = async () => {
  const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
};

export default function App() {
  const [status, setStatus] = useState('جاري تهيئة التطبيق...');
  const [error, setError] = useState(null);
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // هذه الدالة ستقوم بتشغيل المنطق الرئيسي بعد التأكد من جاهزية تليجرام
    const runAppLogic = async (tgUser) => {
      setUser(tgUser);
      setStatus('جاري التحقق من جهازك...');
      try {
        const fingerprint = await loadFingerprint();
        const response = await fetch('/api/auth/check-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: tgUser.id, fingerprint: fingerprint }),
        });
        const data = await response.json();

        if (!data.success) {
          setError(data.message);
          return;
        }

        setStatus('جاري جلب الكورسات...');
        const videoResponse = await fetch('/api/data/get-all-videos');
        const videoData = await videoResponse.json();
        setVideos(videoData);
        setStatus('');

      } catch (err) {
        setError('حدث خطأ أثناء التحقق من الجهاز.');
      }
    };

    // --- المنطق الجديد: "الانتظار الذكي" ---
    const maxRetries = 20; // سنحاول لمدة ثانيتين كحد أقصى
    let retryCount = 0;

    const checkTelegramReady = () => {
      // التحقق من وجود الكائن وجاهزيته
      if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        if (tgUser && tgUser.id) {
          runAppLogic(tgUser); // إذا كان كل شيء جاهزاً، قم بتشغيل المنطق الرئيسي
        } else {
          setError('لم يتم التعرف على بيانات المستخدم من تليجرام.');
        }
      } else {
        // إذا لم يكن جاهزاً، حاول مرة أخرى بعد فترة قصيرة
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(checkTelegramReady, 100); // انتظر 100ms وحاول مجدداً
        } else {
          // إذا فشل بعد عدة محاولات، اعرض رسالة الخطأ
          setError('الرجاء فتح التطبيق من داخل تليجرام.');
        }
      }
    };

    // ابدأ أول عملية تحقق
    checkTelegramReady();

  }, []); // هذا الـ Hook يعمل مرة واحدة فقط عند تحميل الصفحة

  if (error) {
    return <div><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (status) {
    return <div><Head><title>جاري التحميل</title></Head><h1>{status}</h1></div>;
  }

  // (باقي الكود لعرض الفيديوهات يبقى كما هو)
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
