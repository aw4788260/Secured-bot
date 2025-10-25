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
    return <div><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (!youtubeId || !user) {
    return <div><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;
  }

  // --- إعدادات مشغل يوتيوب (لجعله أنظف) ---
  const opts = {
    playerVars: {
      autoplay: 1,
      controls: 1,          // إظهار التحكمات السفلية (play/pause/volume)
      rel: 0,               // عدم إظهار فيديوهات مقترحة في النهاية
      showinfo: 0,          // إخفاء عنوان الفيديو
      modestbranding: 1,    // تقليل شعار يوتيوب
      disablekb: 1,         // تعطيل اختصارات لوحة المفاتيح
    },
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: '10px' }}>
      <Head><title>مشاهدة الدرس</title></Head>
      
      {/* --- الحاوية الرئيسية للمشغل والطبقات --- */}
      <div style={{
        position: 'relative', // ضروري لعمل الطبقات فوق بعضها
        width: '100%',
        maxWidth: '900px', 
        margin: 'auto',
        aspectRatio: '16 / 9',
      }}>
        
        {/* --- 1. مشغل اليوتيوب (في الخلفية) --- */}
        <YouTube 
          videoId={youtubeId} 
          opts={opts} 
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute', 
            top: 0, 
            left: 0 
          }}
        />
        
        {/* --- 2. طبقة العلامة المائية والدرع الشفاف (فوق المشغل) --- */}
        <div style={{
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', // يغطي المشغل بالكامل
          zIndex: 10, // يضمن أنه فوق كل شيء
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          // هذا الجزء خاص بالعلامة المائية
          fontSize: '2.5vw', 
          color: 'rgba(255, 255, 255, 0.25)',
          fontWeight: 'bold', 
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          // هذا الجزء يضمن أن الكليك لا ينفذ إلى ما تحته (لكن لا يمنع التحكمات السفلية)
          pointerEvents: 'auto', // افتراضي، لكن للتأكيد
        }}>
          {/* اسم الطالب كعلامة مائية */}
          {user.first_name} {user.last_name || ''}
        </div>
      </div>
    </div>
  );
}
