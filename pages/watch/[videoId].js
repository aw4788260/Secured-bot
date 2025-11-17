// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// [ ✅✅ جديد: استيراد مكتبة Hls.js عشان Plyr يفهم m3u8 ]
import Hls from 'hls.js'; 

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
            if (watermarkIntervalRef.current) {
                clearInterval(watermarkIntervalRef.current); 
            }
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
    
    const [streamUrl, setStreamUrl] = useState(null); 
    const [youtubeId, setYoutubeId] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [videoTitle, setVideoTitle] = useState("جاري تحميل العنوان...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const playerWrapperRef = useRef(null); 
    const plyrInstanceRef = useRef(null); // (Ref جديد للبلاير)

    // [ ✅✅ جديد: دالة لتشغيل HLS (m3u8) ]
    useEffect(() => {
        // (لا تعمل إلا إذا اللينك وصل، والبلاير جاهز)
        if (!streamUrl || !plyrInstanceRef.current) return;
        
        const videoElement = plyrInstanceRef.current.plyr.media;
        
        if (Hls.isSupported()) {
            // (لو المتصفح (زي Chrome) محتاج مساعدة Hls.js)
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(videoElement);
            console.log("HLS.js attached");
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // (لو المتصفح (زي Safari/iOS) بيدعم m3u8 أصلاً)
            videoElement.src = streamUrl;
            console.log("Native HLS support detected");
        }
    }, [streamUrl]); // (هتشتغل لما الـ streamUrl ييجي)


    useEffect(() => {
        
        const setupUserAndLoadVideo = (foundUser) => {
            if (foundUser && foundUser.id) { 
                setUser(foundUser); 
            } else { 
                setError("خطأ: لا يمكن التعرف على المستخدم."); 
                return; 
            }

            if (videoId) {
                // (الـ API ده هيرجع m3u8 streamUrl)
                fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                    .then(res => { 
                        if (!res.ok) {
                          return res.json().then(errData => {
                              throw new Error(errData.message || 'لا تملك صلاحية مشاهدة هذا الفيديو');
                          }).catch(() => {
                              throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو');
                          });
                        }
                        return res.json(); 
                    })
                    .then(data => {
                        if (data.message) throw new Error(data.message); 
                        
                        setStreamUrl(data.streamUrl); // <-- ده لينك m3u8
                        setYoutubeId(data.youtube_video_id);
                        setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                    })
                    .catch(err => setError(err.message));
            }
        };

        // (منطق التحقق من المستخدم - يبقى كما هو)
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
        
    }, [videoId]); 

    // (دالة التحميل - سليمة ومش محتاجة تعديل)
    const handleDownloadClick = () => {
        if (!youtubeId) { 
            alert("بيانات الفيديو غير جاهزة بعد، يرجى الانتظار ثانية.");
            return;
        }
        if (isNativeAndroid) {
            try {
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
    if (!user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري التحقق...</h1></div>; }
    
    // (هنرجع فيديو فاضي، والـ useEffect هو اللي هيحط اللينك)
    const plyrSource = {
      type: 'video',
      title: videoTitle,
      sources: [], // (هنسيبه فاضي في الأول)
    };
    
    const plyrOptions = {
        controls: [
            'play-large', 'play', 'progress', 'current-time',
            'mute', 'volume', 'settings', 'fullscreen'
        ],
        // (Plyr هيفهم إن ده HLS وهيظهر الجودات لوحده)
        settings: ['quality', 'speed'], 
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
                
                {/* [ ✅✅ تعديل: 
                   1. هنستخدم ref عشان نوصل للبلاير.
                   2. هنعرض شاشة تحميل لو اللينك لسه مجاش.
                ] 
                */}
                {!streamUrl && (
                     <div className="message-container" style={{position: 'absolute', height: '100%'}}>
                         <h1>جاري تحميل الفيديو...</h1>
                     </div>
                )}
                
                <Plyr
                  ref={plyrInstanceRef} // (ربط الـ Ref)
                  source={plyrSource} 
                  options={plyrOptions}
                />
                
                <Watermark user={user} />
            </div>

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

            {/* (الـ CSS يبقى كما هو) */}
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
