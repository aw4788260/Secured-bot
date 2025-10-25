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
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;

      if (!tgUser) {
        setError('لا يمكن التعرف على هويتك. الرجاء الفتح من تليجرام.');
        return;
      }
      setUser(tgUser);

      loadFingerprint().then(fingerprint => {
        fetch('/api/auth/check-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: tgUser.id, fingerprint: fingerprint }),
        })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            setError(data.message);
          } else {
            setStatus('جاري جلب الكورسات...');
            fetch('/api/data/get-all-videos')
              .then(res => res.json())
              .then(videoData => {
                setVideos(videoData);
                setStatus(''); 
              });
          }
        });
      });
    } else if (typeof window !== 'undefined') {
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
