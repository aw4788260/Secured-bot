// pages/watch/[videoId].js
'use client';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-http-source-selector';

const Watermark = ({ user }) => {
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
  const watermarkIntervalRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    watermarkIntervalRef.current = setInterval(() => {
      const newTop = Math.floor(Math.random() * 70) + 10;
      const newLeft = Math.floor(Math.random() * 70) + 10;
      setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
    }, 5000);

    return () => {
      if (watermarkIntervalRef.current) clearInterval(watermarkIntervalRef.current);
    };
  }, [user]);

  return (
    <div
      className="watermark"
      style={{
        position: 'absolute',
        top: watermarkPos.top,
        left: watermarkPos.left,
        zIndex: 15,
        pointerEvents: 'none',
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        fontSize: 'clamp(10px, 2.5vw, 14px)',
        borderRadius: 4,
        fontWeight: 'bold',
        transition: 'top 2s ease-in-out, left 2s ease-in-out',
        whiteSpace: 'nowrap',
      }}
    >
      {user.first_name} ({user.id})
    </div>
  );
};

export default function WatchPage() {
  const router = useRouter();
  const { videoId } = router.query;

  const [streamUrl, setStreamUrl] = useState(null);
  const [youtubeId, setYoutubeId] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [videoTitle, setVideoTitle] = useState('جاري التحميل...');
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);

  const videoRef = useRef(null);
  const playerRef = useRef(null);

  // ----------------------
  // جلب البيانات
  // ----------------------
  useEffect(() => {
    const setupUser = (u) => {
      if (u && u.id) setUser(u);
      else setError('خطأ: لا يمكن التعرف على المستخدم.');
    };

    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get('userId');
    const urlFirstName = params.get('firstName');

    if (urlUserId) {
      setupUser({ id: urlUserId, first_name: urlFirstName || 'User' });
      if (window.Android) setIsNativeAndroid(true);
    } else if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      const u = window.Telegram.WebApp.initDataUnsafe?.user;
      if (u) setupUser(u);
      else setError('يرجى الفتح من تليجرام.');
    } else {
      setError('يرجى الفتح من التطبيق المخصص.');
    }

    if (videoId) {
      fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
        .then((res) =>
          res.ok
            ? res.json()
            : res.json().then((e) => {
                throw new Error(e.message);
              })
        )
        .then((data) => {
          if (data.message) throw new Error(data.message);
          setStreamUrl(data.streamUrl);
          setYoutubeId(data.youtube_video_id);
          setVideoTitle(data.videoTitle || 'مشاهدة الدرس');
        })
        .catch((err) => setError(err.message));
    }
  }, [videoId]);

  // ----------------------
  // تهيئة Video.js
  // ----------------------
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const player = videojs(videoRef.current, {
      autoplay: false,
      controls: true,
      fluid: true,
      responsive: true,
      sources: [{ src: streamUrl, type: 'application/x-mpegURL' }],
    });

    // تفعيل Quality Selector
    player.httpSourceSelector({ default: 'auto' });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [streamUrl]);

  // ----------------------
  // تحميل الفيديو
  // ----------------------
  const handleDownloadClick = () => {
    if (!youtubeId) return alert('انتظر..');
    if (isNativeAndroid) {
      try {
        window.Android.downloadVideo(youtubeId, videoTitle);
      } catch {
        alert('خطأ في الاتصال.');
      }
    } else {
      alert('متاح فقط في التطبيق.');
    }
  };

  if (error) return <div className="message-container"><h1>{error}</h1></div>;
  if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

  return (
    <div className="page-container">
      <Head>
        <title>مشاهدة الدرس</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
      </Head>

      <div className="player-wrapper">
        <video ref={videoRef} className="video-js vjs-big-play-centered" />
        <Watermark user={user} />
      </div>

      {isNativeAndroid && (
        <button onClick={handleDownloadClick} className="download-button-native">
          ⬇️ تحميل الفيديو (أوفلاين)
        </button>
      )}

      <footer className="developer-info">
        <p>برمجة وتطوير: A7MeD WaLiD</p>
        <p>
          للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank">اضغط هنا</a>
        </p>
      </footer>

      <style jsx global>{`
        body { margin: 0; background: #111; color: white; font-family: sans-serif; }

        .page-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; position: relative; padding: 10px; }

        .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; }

        .player-wrapper {
          width: 100%;
          max-width: 900px;
          aspect-ratio: 16/9;
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          background: #000;
        }

        .download-button-native {
          width: 100%;
          max-width: 900px;
          padding: 15px;
          margin-top: 20px;
          background: #38bdf8;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          color: #111;
          cursor: pointer;
        }

        .developer-info {
          position: absolute;
          bottom: 10px;
          width: 100%;
          text-align: center;
          font-size: 0.85rem;
          color: #777;
        }
        .developer-info a { color: #38bdf8; text-decoration: none; }
      `}</style>
    </div>
  );
}
