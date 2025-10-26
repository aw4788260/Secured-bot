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

  // --- جديد: متغيرات حالة لشريط التقدم والتحكم ---
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSeekIcon, setShowSeekIcon] = useState({ direction: null, visible: false });
  const seekTimeoutRef = useRef(null);

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

    // --- جديد: تحديث الوقت الحالي كل ثانية ---
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);

    return () => clearInterval(interval); // تنظيف المؤقت عند إغلاق الصفحة

  }, [videoId]);

  // --- دوال التحكم ---
  const handlePlayPause = () => {
    if (!playerRef.current) return;
    const playerState = playerRef.current.getPlayerState();
    if (playerState === 1) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const handleSeek = (direction) => {
    if (!playerRef.current) return;
    const currentTimeVal = playerRef.current.getCurrentTime();
    const newTime = direction === 'forward' ? currentTimeVal + 10 : currentTimeVal - 10;
    playerRef.current.seekTo(newTime, true);

    // --- جديد: إظهار الأيقونة المتحركة ---
    setShowSeekIcon({ direction: direction, visible: true });
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => {
      setShowSeekIcon({ direction: null, visible: false });
    }, 600); // إخفاء الأيقونة بعد 0.6 ثانية
  };
  
  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    setDuration(event.target.getDuration()); // حفظ المدة الإجمالية للفيديو
  };
  
  // --- جديد: دالة للانتقال عند النقر على شريط التقدم ---
  const handleProgressBarClick = (e) => {
    if (!playerRef.current) return;
    const bar = e.currentTarget;
    const clickPosition = e.clientX - bar.getBoundingClientRect().left;
    const barWidth = bar.offsetWidth;
    const seekTime = (clickPosition / barWidth) * duration;
    playerRef.current.seekTo(seekTime, true);
  };

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  if (error) return <div className="container"><h1>{error}</h1></div>;
  if (!youtubeId || !user) return <div className="container"><h1>جاري تحميل الفيديو...</h1></div>;

  const opts = {
    playerVars: {
      autoplay: 0, controls: 0, rel: 0, showinfo: 0, modestbranding: 1, disablekb: 1,
    },
  };

  // --- الستايلات ---
  const containerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#000', padding: '10px' };
  const videoWrapperStyle = { position: 'relative', width: '100%', maxWidth: '900px', paddingTop: '56.25%', overflow: 'hidden' };
  const playerStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };

  return (
    <div style={containerStyle}>
      <Head>
        <title>مشاهدة الدرس</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div style={videoWrapperStyle}>
        <YouTube videoId={youtubeId} opts={opts} style={playerStyle} onReady={onPlayerReady} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnd={() => setIsPlaying(false)} />
        
        <div style={{ ...playerStyle, zIndex: 10, display: 'flex', flexDirection: 'column' }}>
          
          {/* طبقة التحكم العلوية (للنقرات) */}
          <div style={{ flexGrow: 1, display: 'flex' }}>
            <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('backward')}></div>
            <div style={{ flex: 2, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={handlePlayPause}>
              {!isPlaying && <div style={{ fontSize: '80px', color: 'white', textShadow: '0 0 15px rgba(0,0,0,0.8)' }}>▶</div>}
            </div>
            <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('forward')}></div>
          </div>
          
          {/* --- جديد: شريط التحكم السفلي --- */}
          <div style={{ height: '40px', display: 'flex', alignItems: 'center', padding: '0 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
            <span style={{ color: 'white', fontSize: '12px', marginRight: '10px' }}>{formatTime(currentTime)}</span>
            <div 
              style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}
              onClick={handleProgressBarClick}
            >
              <div style={{ height: '100%', width: `${(currentTime / duration) * 100}%`, background: '#FF0000', borderRadius: '2px' }}></div>
            </div>
            <span style={{ color: 'white', fontSize: '12px', marginLeft: '10px' }}>{formatTime(duration)}</span>
          </div>

          {/* --- جديد: أيقونات التقديم والتأخير المتحركة --- */}
          {showSeekIcon.visible && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: showSeekIcon.direction === 'forward' ? '75%' : '25%',
              transform: 'translate(-50%, -50%)',
              fontSize: '40px',
              color: 'white',
              opacity: 0.8,
              transition: 'opacity 0.5s ease-out',
              animation: 'seek-pop 0.6s ease-out'
            }}>
              {showSeekIcon.direction === 'forward' ? '» 10' : '10 «'}
            </div>
          )}

          {/* العلامة المائية */}
          <div style={{
            position: 'absolute', top: '15px', right: '15px',
            fontSize: '1.5vw', color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
          }}>
            {user.first_name} {user.last_name || ''}
          </div>
        </div>
      </div>
      
      {/* --- جديد: إضافة الـ CSS للحركة --- */}
      <style jsx global>{`
        @keyframes seek-pop {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          50% { transform: translate(-50%, -50%) scale(1.2); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
