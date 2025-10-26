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
  
  const [playerSize, setPlayerSize] = useState({ width: '100%', height: 'auto' });
  const wrapperRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSeekIcon, setShowSeekIcon] = useState({ direction: null, visible: false });
  const seekTimeoutRef = useRef(null);

  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
  const watermarkIntervalRef = useRef(null);

  useEffect(() => {
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

    const updateSize = () => {
      if (wrapperRef.current) {
        const containerWidth = wrapperRef.current.offsetWidth;
        // **تعديل 1: تغيير نسبة الأبعاد إلى 13 (عرض) لـ 16 (ارتفاع)**
        const calculatedHeight = containerWidth * (16 / 13); 
        setPlayerSize({ width: containerWidth, height: calculatedHeight });
      }
    };

    updateSize(); 
    window.addEventListener('resize', updateSize);

    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);

    watermarkIntervalRef.current = setInterval(() => {
        const newTop = Math.floor(Math.random() * 70) + 10; 
        const newLeft = Math.floor(Math.random() * 60) + 10; // تقليل النطاق الأفقي
        setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
    }, 5000); 


    return () => {
        window.removeEventListener('resize', updateSize);
        clearInterval(interval);
        clearInterval(watermarkIntervalRef.current);
    };
  }, [videoId]);

  const handlePlayPause = () => { /* ... (تبقى كما هي) ... */ };
  const handleSeek = (direction) => { /* ... (تبقى كما هي) ... */ };
  const onPlayerReady = (event) => { /* ... (تبقى كما هي) ... */ };
  const handleProgressBarClick = (e) => { /* ... (تبقى كما هي) ... */ };
  const formatTime = (timeInSeconds) => { /* ... (تبقى كما هي) ... */ };
  
  // (منطق التحكم يبقى كما هو بدون تغيير)

  if (error) return <div className="container"><h1>{error}</h1></div>;
  if (!youtubeId || !user || playerSize.width === 0) return <div className="container"><h1>جاري تحميل الفيديو...</h1></div>;

  const opts = {
    height: playerSize.height,
    width: playerSize.width,
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
      
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '450px' }}> {/* تقليل العرض الأقصى ليناسب الأبعاد الطولية */}
        
        <div style={{ position: 'relative', width: playerSize.width, height: playerSize.height }}>
          
          <YouTube 
            videoId={youtubeId} 
            opts={opts}
            style={{ width: '100%', height: '100%' }}
            onReady={onPlayerReady}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnd={() => setIsPlaying(false)}
          />
          
          <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              zIndex: 10, 
              display: 'flex',
              flexDirection: 'column' 
          }}>
            <div style={{ flexGrow: 1, display: 'flex' }}>
                <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('backward')}></div>
                <div style={{ flex: 2, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={handlePlayPause}>
                  {!isPlaying && <div style={{ fontSize: '80px', color: 'white', textShadow: '0 0 15px rgba(0,0,0,0.8)' }}>▶</div>}
                </div>
                <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('forward')}></div>
            </div>

            <div style={{ height: '40px', display: 'flex', alignItems: 'center', padding: '0 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', zIndex: 11 }}>
                <span style={{ color: 'white', fontSize: '12px', marginRight: '10px', minWidth: '40px' }}>{formatTime(currentTime)}</span>
                <div 
                  style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}
                  onClick={handleProgressBarClick}
                >
                  <div style={{ height: '100%', width: `${(currentTime / duration) * 100}%`, background: '#FF0000', borderRadius: '2px' }}></div>
                </div>
                <span style={{ color: 'white', fontSize: '12px', marginLeft: '10px', minWidth: '40px' }}>{formatTime(duration)}</span>
            </div>

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
                animation: 'seek-pop 0.6s ease-out',
                pointerEvents: 'none'
              }}>
                {showSeekIcon.direction === 'forward' ? '» 10' : '10 «'}
              </div>
            )}
            
            {/* **تعديل 2: العلامة المائية الجديدة** */}
            <div style={{
              position: 'absolute',
              top: watermarkPos.top,
              left: watermarkPos.left,
              padding: '4px 8px', // إضافة هوامش داخلية
              background: 'rgba(0, 0, 0, 0.8)', // خلفية سوداء شفافة
              color: 'white', // كتابة بيضاء
              fontSize: '12px', // حجم خط أصغر
              borderRadius: '4px', // حواف دائرية
              fontWeight: 'bold',
              pointerEvents: 'none',
              transition: 'top 2s ease-in-out, left 2s ease-in-out',
              whiteSpace: 'nowrap' // منع التفاف النص
            }}>
              {user.first_name} ({user.id})
            </div>
          </div>
        </div>
      </div>
      
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
