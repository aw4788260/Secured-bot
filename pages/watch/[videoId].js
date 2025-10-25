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
  
  // --- لتتبع حالة التشغيل والتحكم في المشغل ---
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null); // للوصول إلى مشغل يوتيوب مباشرة

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      
      if (tgUser) {
        setUser(tgUser);
      } else {
        setError("خطأ: لا يمكن التعرف على المستخدم.");
        return;
      }
      
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
  }, [videoId]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    
    // الحصول على الحالة الحالية للمشغل مباشرة منه لضمان الدقة
    const playerState = playerRef.current.getPlayerState();
    // 1 = playing, 2 = paused, 5 = cued
    if (playerState === 1) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const onPlayerReady = (event) => {
    playerRef.current = event.target;
  };

  if (error) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', padding: '20px' }}>
            <Head><title>خطأ</title></Head>
            <h1>{error}</h1>
        </div>
    );
  }
  if (!youtubeId || !user) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', padding: '20px' }}>
            <Head><title>جاري التحميل</title></Head>
            <h1>جاري تحميل الفيديو...</h1>
        </div>
    );
  }

  // --- إعدادات جديدة لإخفاء كل شيء ---
  const opts = {
    playerVars: {
      autoplay: 0,      
      controls: 0,      // إخفاء كل أزرار التحكم
      rel: 0,           
      showinfo: 0,      
      modestbranding: 1,
      disablekb: 1,     
    },
  };

  // --- الستايلات المباشرة لحل مشكلة الأبعاد ---
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#000',
    padding: '10px'
  };

  const videoWrapperStyle = {
    position: 'relative',
    width: '100%',
    maxWidth: '900px',
    paddingTop: '56.25%', // خدعة الأبعاد 16:9
  };

  const playerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  };

  return (
    <div style={containerStyle}>
      <Head><title>مشاهدة الدرس</title></Head>
      
      <div style={videoWrapperStyle}>
        
        {/* مشغل يوتيوب (الطبقة السفلية) */}
        <YouTube 
          videoId={youtubeId} 
          opts={opts}
          style={playerStyle}
          onReady={onPlayerReady}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnd={() => setIsPlaying(false)}
        />
        
        {/* طبقة التحكم والواجهة (الطبقة العلوية) */}
        <div 
          style={{...playerStyle, zIndex: 10, cursor: 'pointer', background: 'rgba(0,0,0,0.1)' }}
          onClick={handlePlayPause}
        >
          {/* أيقونة التشغيل التي تظهر فقط عندما يكون الفيديو متوقفاً */}
          {!isPlaying && (
            <div style={{
              width: '100%', height: '100%', display: 'flex', 
              justifyContent: 'center', alignItems: 'center',
              fontSize: '80px', color: 'white',
              textShadow: '0px 0px 15px rgba(0,0,0,0.8)'
            }}>
              ▶
            </div>
          )}

          {/* العلامة المائية */}
          <div style={{
            position: 'absolute', bottom: '10px', right: '10px',
            fontSize: '1.5vw', color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
          }}>
            {user.first_name} {user.last_name || ''}
          </div>
        </div>
      </div>
    </div>
  );
}
