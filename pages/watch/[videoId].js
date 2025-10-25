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
  
  // --- جديد: لتتبع حالة التشغيل والتحكم في المشغل ---
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
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
    setIsPlaying(!isPlaying);
  };

  const onPlayerReady = (event) => {
    // حفظ نسخة من المشغل للتحكم به لاحقًا
    playerRef.current = event.target;
  };

  if (error) return <div className="container"><h1>{error}</h1></div>;
  if (!youtubeId || !user) return <div className="container"><h1>جاري تحميل الفيديو...</h1></div>;

  // --- إعدادات جديدة لإخفاء كل شيء ---
  const opts = {
    playerVars: {
      autoplay: 0,      // لن يتم التشغيل تلقائياً
      controls: 0,      // **أهم تعديل: إخفاء كل أزرار التحكم**
      rel: 0,           
      showinfo: 0,      
      modestbranding: 1,
      disablekb: 1,     
    },
  };

  return (
    <div className="container">
      <Head><title>مشاهدة الدرس</title></Head>
      
      <div className="videoWrapper">
        <YouTube 
          videoId={youtubeId} 
          opts={opts}
          className="videoPlayer"
          onReady={onPlayerReady} // دالة لحفظ المشغل عند جاهزيته
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnd={() => setIsPlaying(false)}
        />
        
        {/* --- طبقة التحكم والواجهة الجديدة --- */}
        <div 
          className="overlay" 
          style={{ zIndex: 10, cursor: 'pointer', background: 'rgba(0,0,0,0.2)' }}
          onClick={handlePlayPause} // التحكم في التشغيل/الإيقاف عند النقر
        >
          {/* أيقونة التشغيل/الإيقاف التي تظهر وتختفي */}
          {!isPlaying && (
            <div style={{
              fontSize: '80px', color: 'white',
              textShadow: '0px 0px 15px rgba(0,0,0,0.8)'
            }}>
              ▶
            </div>
          )}

          {/* العلامة المائية (موجودة دائمًا في الخلفية) */}
          <div style={{
            position: 'absolute', bottom: '10px', right: '10px',
            fontSize: '1.5vw', color: 'rgba(255, 255, 255, 0.3)',
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
