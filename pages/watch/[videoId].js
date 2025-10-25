// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

export default function WatchPage() {
  const router = useRouter();
  const { videoId } = router.query;
  const [youtubeId, setYoutubeId] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

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

  if (error) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (!youtubeId || !user) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;
  }

  // --- إعدادات مشغل يوتيوب ---
  const opts = {
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,           
      showinfo: 0,      
      modestbranding: 1,
      disablekb: 1,     
    },
  };

  // --- الستايلات المباشرة لحل المشكلة ---
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
    /* هذه هي الخدعة الكلاسيكية للأبعاد 16:9 */
    paddingTop: '56.25%', 
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
          style={playerStyle} // تطبيق ستايل المشغل
        />
        
        {/* طبقة الحماية الشاملة (الطبقة العلوية) */}
        <div style={{
          ...playerStyle, // تأخذ نفس أبعاد المشغل
          height: 'calc(100% - 50px)', // نترك 50 بكسل بالأسفل لشريط التحكم
          zIndex: 10,
        }}>
          
          {/* العلامة المائية (داخل طبقة الحماية) */}
          <div style={{
            width: '100%', height: '100%', display: 'flex', 
            justifyContent: 'center', alignItems: 'center',
            fontSize: '2.5vw', color: 'rgba(255, 255, 255, 0.25)',
            fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            pointerEvents: 'none', // العلامة المائية لا تتفاعل مع النقر
          }}>
            {user.first_name} {user.last_name || ''}
          </div>
        </div>
      </div>
    </div>
  );
}
