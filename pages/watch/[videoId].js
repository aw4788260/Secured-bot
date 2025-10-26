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
        // **تصحيح 1: تطبيق نسبة الأبعاد المطلوبة 13:16**
        const calculatedHeight = containerWidth * (16 / 13); 
        setPlayerSize({ width: containerWidth, height: calculatedHeight });
      }
    };

    updateSize(); 
    window.addEventListener('resize', updateSize);

    const timeInterval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);

    watermarkIntervalRef.current = setInterval(() => {
        const newTop = Math.floor(Math.random() * 70) + 10; 
        const newLeft = Math.floor(Math.random() * 60) + 10;
        setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
    }, 5000); 

    return () => {
        window.removeEventListener('resize', updateSize);
        clearInterval(timeInterval);
        clearInterval(watermarkIntervalRef.current);
    };
  }, [videoId]);

  // --- (باقي دوال التحكم تبقى كما هي) ---
  const handlePlayPause = () => {
    if (!playerRef.current) return;
    const playerState = playerRef.current.getPlayerState();
    if (playerState === 1) { // is playing
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };
  const handleSeek = (direction) => {
    if (!playerRef.current) return;
    const currentTimeVal = playerRef.current.getCurrentTime();
    const newTime = direction === 'forward' ? currentTimeVal + 10 : currentTimeVal - 10;
    playerRef.current.seekTo(newTime, true);
    setShowSeekIcon({ direction: direction, visible: true });
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => {
      setShowSeekIcon({ direction: null, visible: false });
    }, 600);
  };
  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    setDuration(event.target.getDuration());
  };
  const handleProgressBarClick = (e) => {
    if (!playerRef.current || duration === 0) return;
    const bar = e.currentTarget;
    const clickPosition = e.clientX - bar.getBoundingClientRect().left;
    const barWidth = bar.offsetWidth;
    const seekTime = (clickPosition / barWidth) * duration;
    playerRef.current.seekTo(seekTime, true);
    setCurrentTime(seekTime); 
  };
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  if (error) return <div className="container"><h1>{error}</h1></div>;
  if (!youtubeId || !user || !playerSize.width || playerSize.width === '100%') return <div className="container"><h1>جاري تحميل الفيديو...</h1></div>;

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
      
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '450px' }}>
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
          
          {/* **تصحيح 2: فصل الطبقات المرئية عن طبقة التحكم** */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
              {/* الطبقة المرئية (Visual Layer) - لا تتفاعل مع اللمس */}
              {!isPlaying && <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '80px', color: 'white', textShadow: '0 0 15px rgba(0,0,0,0.8)' }}>▶</div>}
              
              {showSeekIcon.visible && (
                <div style={{
                  position: 'absolute', top: '50%', left: showSeekIcon.direction === 'forward' ? '75%' : '25%',
                  transform: 'translate(-50%, -50%)', fontSize: '40px', color: 'white',
                  animation: 'seek-pop 0.6s ease-out'
                }}>
                  {showSeekIcon.direction === 'forward' ? '» 10' : '10 «'}
                </div>
              )}
              
              <div style={{
                position: 'absolute', top: watermarkPos.top, left: watermarkPos.left,
                padding: '4px 8px', background: 'rgba(0, 0, 0, 0.8)', color: 'white',
                fontSize: '12px', borderRadius: '4px', fontWeight: 'bold',
                transition: 'top 2s ease-in-out, left 2s ease-in-out', whiteSpace: 'nowrap'
              }}>
                {user.first_name} ({user.id})
              </div>
          </div>

          {/* طبقة التحكم (Control Layer) - هي التي تستقبل النقرات */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 40px)', zIndex: 12, display: 'flex' }}>
              <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('backward')}></div>
              <div style={{ flex: 2, height: '100%', cursor: 'pointer' }} onClick={handlePlayPause}></div>
              <div style={{ flex: 1, height: '100%' }} onDoubleClick={() => handleSeek('forward')}></div>
          </div>
          
          {/* شريط التحكم السفلي */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px', display: 'flex', alignItems: 'center', padding: '0 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', zIndex: 11 }}>
              <span style={{ color: 'white', fontSize: '12px', marginRight: '10px', minWidth: '40px' }}>{formatTime(currentTime)}</span>
              <div 
                style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', cursor: 'pointer' }}
                onClick={handleProgressBarClick}
              >
                <div style={{ height: '100%', width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, background: '#FF0000', borderRadius: '2px' }}></div>
              </div>
              <span style={{ color: 'white', fontSize: '12px', marginLeft: '10px', minWidth: '40px' }}>{formatTime(duration)}</span>
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
