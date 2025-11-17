// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (المكتبات زي ما هي)
import dynamic from 'next/dynamic';
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';


// (كومبوننت العلامة المائية زي ما هو - مفيش تغيير)
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
            clearInterval(watermarkIntervalRef.current); 
        };
    }, [user]);

    return (
        <div className="watermark" style={{ 
            position: 'absolute', 
            top: watermarkPos.top, 
            left: watermarkPos.left,
            zIndex: 15, 
            pointerEvents: 'none',
            padding: '4px 8px', 
            background: 'rgba(0, 0, 0, 0.7)', 
            color: 'white', 
            fontSize: 'clamp(10px, 2.5vw, 14px)',
            borderRadius: '4px',
            fontWeight: 'bold',
            transition: 'top 2s ease-in-out, left 2s ease-in-out',
            whiteSpace: 'nowrap'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};


export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    // [ ✅✅ تعديل: محتاجين الـ ID للتحميل، واللينك للتشغيل ]
    const [streamUrl, setStreamUrl] = useState(null); // <-- للتشغيل (الستريم الجديد)
    const [youtubeId, setYoutubeId] = useState(null); // <-- للتحميل (زرار الأندرويد)

    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    
    const [videoTitle, setVideoTitle] = useState("جاري تحميل العنوان...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const playerWrapperRef = useRef(null); 


    useEffect(() => {
        
        const setupUserAndLoadVideo = (foundUser) => {
            if (foundUser && foundUser.id) { 
                setUser(foundUser); 
            } else { 
                setError("خطأ: لا يمكن التعرف على المستخدم."); 
                return; 
            }

            if (videoId) {
                // [ ✅✅ تعديل: جلب البيانات من الـ API الجديد ]
                fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                    .then(res => { 
                        if (!res.ok) {
                          // محاولة قراءة رسالة الخطأ من السيرفر
                          return res.json().then(errData => {
                              throw new Error(errData.message || 'لا تملك صلاحية مشاهدة هذا الفيديو');
                          }).catch(() => {
                              // لو فشل قراءة الـ JSON (مثلاً 500 Server Error)
                              throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو');
                          });
                        }
                        return res.json(); 
                    })
                    .then(data => {
                        // لو السيرفر رجع خطأ (زي خطأ Railway)
                        if (data.message) throw new Error(data.message); 
                        
                        // [ ✅✅ تعديل: حفظ اللينك والـ ID ]
                        setStreamUrl(data.streamUrl); 
                        setYoutubeId(data.youtube_video_id);
                        setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                    })
                    .catch(err => setError(err.message));
            }
        };

        // (منطق التحقق من المستخدم - يبقى كما هو تماماً)
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        if (urlUserId && urlUserId.trim() !== '') {
            const apkUser = { 
                id: urlUserId, 
                first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User"
            };
            setupUserAndLoadVideo(apkUser); 

            if (typeof window.Android !== 'undefined' && typeof window.Android.downloadVideo === 'function') {
                setIsNativeAndroid(true);
            }

        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const platform = window.Telegram.WebApp.platform;
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;

            if (!miniAppUser || !miniAppUser.id) {
                setError("لا يمكن التعرف على هويتك من تليجرام.");
                return;
            }

            if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
                setupUserAndLoadVideo(miniAppUser);
            } else {
                fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
                    .then(res => res.json())
                    .then(adminData => {
                        if (adminData.isAdmin) {
                            setupUserAndLoadVideo(miniAppUser);
                        } else {
                            setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                        }
                    })
                    .catch(err => {
                        setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
                    });
            }
        } else {
             setError('الرجاء الفتح من البرنامج المخصص (للأندرويد) أو من تليجرام.');
             return;
        }
        
    }, [videoId]); // (الـ dependencies زي ما هي)

    // [ ✅✅ تعديل: دالة التحميل مبقتش محتاجة fakeVideoTitle ]
    // (الدالة دي سليمة 100% لأنها بتعتمد على `youtubeId` اللي لسه موجود)
    const handleDownloadClick = () => {
        if (!youtubeId) { // (لسه بنعتمد على الـ ID)
            alert("بيانات الفيديو غير جاهزة بعد، يرجى الانتظار ثانية.");
            return;
        }

        if (isNativeAndroid) {
            try {
                // (هنا بنبعت الـ ID الأصلي والاسم الحقيقي اللي جبناه من Railway)
                window.Android.downloadVideo(youtubeId, videoTitle);
            } catch (e) {
                console.error("Error calling native bridge:", e);
                alert("حدث خطأ أثناء الاتصال بالتطبيق.");
            }
        } else {
            alert("التحميل الأوفلاين متاح فقط من داخل تطبيق الأندرويد الرسمي.");
        }
    };


    if (error) { return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>; }
    
    // [ ✅✅ تعديل: شاشة التحميل بقت بتعتمد على الـ streamUrl ]
    if (!streamUrl || !user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>; }
    
    // [ ✅✅ تعديل: إعدادات مشغل Plyr ]
    // (مبقاش "يوتيوب"، بقى "فيديو عادي")
    const plyrSource = {
      type: 'video',
      title: videoTitle,
      sources: [
        {
          src: streamUrl, // <-- [✅✅ الأهم] بنستخدم الستريم الجديد
          type: 'video/mp4', // <-- [✅✅ الأهم] بنقوله إنه ملف فيديو
        },
      ],
    };
    
    // (الإعدادات زي ما هي، بس Plyr هيتجاهل إعدادات 'youtube' لأنه مبقاش يوتيوب)
    const plyrOptions = {
        controls: [
            'play-large', 'play', 'progress', 'current-time',
            'mute', 'volume', 'settings', 'fullscreen'
        ],
        settings: ['quality', 'speed'],
        youtube: { // (ده هيتم تجاهله)
            rel: 0, 
            showinfo: 0, 
            modestbranding: 1, 
            controls: 0, 
        },
        fullscreen: {
            enabled: true,
            fallback: true,
            iosNative: true,
            container: '.player-wrapper'
        }
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div className="player-wrapper" ref={playerWrapperRef}>
                
                <Plyr
                  source={plyrSource} // <-- بنمرر الستريم الجديد
                  options={plyrOptions}
                />
                
                <Watermark user={user} />
            </div>

            {/* (زرار التحميل هيفضل شغال زي ما هو) */}
            {isNativeAndroid && (
                <button 
                    onClick={handleDownloadClick} 
                    className="download-button-native"
                >
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
              <p>برمجة وتطوير: A7MeD WaLiD</p>
              <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>

            {/* (الـ CSS زي ما هو بالظبط) */}
            <style jsx global>{`
                body { margin: 0; overscroll-behavior: contain; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 10px; box-sizing: border-box; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; padding: 20px; text-align: center; }
                
                .player-wrapper { 
                    position: relative; 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: 16 / 7; 
                    background: #111; 
                    border-radius: 8px; 
                    overflow: hidden; 
                }
                
                .player-wrapper:fullscreen,
                .player-wrapper:-webkit-full-screen,
                .player-wrapper:-moz-full-screen,
                .player-wrapper:-ms-fullscreen {
                    width: 100%;
                    height: 100%;
                    max-width: none;
                    aspect-ratio: auto; 
                }
                
                .player-wrapper .plyr {
                    width: 100%;
                    height: 100%;
                }
                
                .download-button-native {
                    background-color: #38bdf8; 
                    color: #111827; 
                    font-weight: bold;
                    padding: 12px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 15px 0 0 0;
                    display: block; 
                    width: 100%;
                    max-width: 900px;
                    transition: background-color 0.3s ease;
                }
                .download-button-native:hover {
                    background-color: #7dd3fc; 
                }
            `}</style>
        </div>
    );
}
