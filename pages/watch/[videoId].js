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
    return <div style={{ color: 'white', padding: '20px' }}><Head><title>خطأ</title></Head><h1>{error}</h1></div>;
  }
  if (!youtubeId || !user) {
    return <div style={{ color: 'white', padding: '20px' }}><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>;
  }

  // إعدادات مشغل يوتيوب
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

  return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      <Head><title>مشاهدة الدرس</title></Head>
      
      {/* --- الحاوية الرئيسية للمشغل والطبقات --- */}
      <div style={{
        position: 'relative', // ضروري لعمل الطبقات
        width: '100%',         // اجعل العرض يملأ المساحة المتاحة
        maxWidth: '900px',     // حد أقصى للعرض على الشاشات الكبيرة
        margin: 'auto',
        aspectRatio: '16 / 9', // **هذا هو السطر الأهم: يجبر الحاوية على الحفاظ على أبعاد الفيديو**
        overflow: 'hidden',    // يضمن عدم خروج أي شيء عن الإطار
      }}>
        
        {/* 1. مشغل اليوتيوب (في الخلفية) */}
        <YouTube 
          videoId={youtubeId} 
          opts={opts}
          // اجعل المشغل يملأ الحاوية بالكامل 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0,
            width: '100%', 
            height: '100%', 
          }}
        />
        
        {/* 2. طبقة الحماية الشاملة */}
        <div style={{
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: 'calc(100% - 40px)', // يغطي كل شيء ما عدا شريط التحكم
          zIndex: 10,
        }}>
          
          {/* 3. العلامة المائية (داخل طبقة الحماية) */}
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            fontSize: '2.5vw', 
            color: 'rgba(255, 255, 255, 0.25)',
            fontWeight: 'bold', 
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            pointerEvents: 'none', // العلامة المائية لا تتفاعل مع النقر
          }}>
            {user.first_name} {user.last_name || ''}
          </div>
        </div>
      </div>
    </div>
  );
}
