// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

export default function WatchPage() {
  const router = useRouter();
  const { videoId } = router.query;
  const [youtubeId, setYoutubeId] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);
  
  // -- جديد: لتخزين أبعاد المشغل المحسوبة --
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const wrapperRef = useRef(null); // للوصول إلى الحاوية وقياسها

  useEffect(() => {
    // ... (منطق جلب البيانات يبقى كما هو)
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      
      if (tgUser) setUser(tgUser);
      else { setError("خطأ: لا يمكن التعرف على المستخدم."); return; }
      
      if (videoId) {
        fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
          .then(res => {
            if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو');
            return res.json();
          })
          .then(data => setYoutubeId(data.youtube_video_id))
          .catch(err => setError(err.message));
      }
    } else {
       setError("الرجاء الفتح من تليجرام.");
    }

    // -- جديد: دالة حساب وتحديث الأبعاد --
    const updateSize = () => {
      if (wrapperRef.current) {
        const containerWidth = wrapperRef.current.offsetWidth;
        // حساب الارتفاع المثالي بناءً على العرض
        const calculatedHeight = containerWidth * (9 / 16);
        setPlayerSize({ width: containerWidth, height: calculatedHeight });
      }
    };

    // حساب الأبعاد عند تحميل الصفحة لأول مرة
    updateSize(); 
    // إعادة حساب الأبعاد عند تغيير حجم النافذة (مهم للهواتف عند تدوير الشاشة)
    window.addEventListener('resize', updateSize);

    // تنظيف المستمع عند إغلاق الصفحة
    return () => window.removeEventListener('resize', updateSize);

  }, [videoId]);

  // --- دوال التحكم ---
  const handlePlayPause = () => { /* ... (تبقى كما هي) ... */ };
  const handleSeek = (direction) => { /* ... (تبقى كما هي) ... */ };
  const onPlayerReady = (event) => { /* ... (تبقى كما هي) ... */ };

  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', padding: '20px' }}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  if (!youtubeId || !user) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', padding: '20px' }}><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;

  const opts = {
    height: playerSize.height, // تطبيق الارتفاع المحسوب
    width: playerSize.width,   // تطبيق العرض المحسوب
    playerVars: {
      autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1,
    },
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#000', padding: '10px' }}>
      <Head>
        <title>مشاهدة الدرس</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      {/* **تعديل 1: إضافة ref للحاوية** */}
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '900px' }}>
        
        {/* نستخدم الأبعاد المحسوبة هنا */}
        <div style={{ position: 'relative', width: playerSize.width, height: playerSize.height }}>
          {/* مشغل يوتيوب (الطبقة السفلية) */}
          <YouTube 
            videoId={youtubeId} 
            opts={opts}
            style={{ width: '100%', height: '100%' }}
            onReady={onPlayerReady}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnd={() => setIsPlaying(false)}
          />
          
          {/* طبقة التحكم (الطبقة العلوية) */}
          <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              zIndex: 10, 
              display: 'flex'
          }}>
            <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('backward')}></div>
            <div style={{ flex: 2, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={handlePlayPause}>
              {!isPlaying && <div style={{ fontSize: '80px', color: 'white', textShadow: '0 0 15px rgba(0,0,0,0.8)' }}>▶</div>}
            </div>
            <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('forward')}></div>
            
            {/* العلامة المائية */}
            <div style={{
              position: 'absolute', bottom: '15px', right: '15px',
              fontSize: '1.5vw', color: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
              pointerEvents: 'none',
            }}>
              {user.first_name} {user.last_name || ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
