// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// (ما زلنا نحتاج استيراد Plyr ديناميكياً)
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// (كومبوننت العلامة المائية - يبقى كما هو)
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
    const plyrInstanceRef = useRef(null); 

    // [ ✅✅✅ هذا هو التعديل البديل (الحل) ]
    // (سنعتمد على تحميل المكتبة من الـ CDN الموجود في <Head>)
    useEffect(() => {
        // (لا تعمل إلا إذا اللينك وصل، والبلاير جاهز)
        if (!streamUrl || !plyrInstanceRef.current) return;

        // (1. الدالة التي ستقوم بتهيئة الفيديو)
        const initializeHls = () => {
            try {
                const videoElement = plyrInstanceRef.current.plyr.media;
                
                // (2. التحقق من وجود المكتبة التي جلبها الـ CDN)
                if (window.Hls && window.Hls.isSupported()) {
                    const Hls = window.Hls; // (استخدام النسخة المحملة في المتصفح)
                    const hls = new Hls();
                    hls.loadSource(streamUrl);
                    hls.attachMedia(videoElement);
                    console.log("HLS.js attached successfully from CDN");
                
                // (3. دعم المتصفحات الأصلية مثل Safari)
                } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    videoElement.src = streamUrl;
                    console.log("Native HLS support detected");
                } else {
                    // (فشل حتى مع الـ CDN)
                    setError("حدث خطأ أثناء تهيئة مشغل الفيديو (HLS not supported).");
                }
            } catch (e) {
                console.error("Error during HLS initialization:", e);
                setError("حدث خطأ فادح أثناء تشغيل الفيديو.");
            }
        };

        // (4. التحقق: هل المكتبة (من الـ CDN) جاهزة؟)
        if (window.Hls) {
            initializeHls();
        } else {
            // (احتياطي: إذا كان السكريبت في <Head> يتأخر في التحميل)
            // (سننتظر ثانية واحدة ونحاول مرة أخرى)
            setTimeout(() => {
                if (window.Hls) {
                    initializeHls();
                } else {
                    console.error("Failed to load hls.js from CDN (Timeout)");
                    setError("حدث خطأ أثناء تحميل مكتبة تشغيل الفيديو.");
                }
            }, 1000); // (انتظار 1 ثانية)
        }

    }, [streamUrl, plyrInstanceRef.current]); // (يعتمد على وصول اللينك والبلاير)


    // (باقي كود الـ useEffect بتاع جلب الداتا - يبقى كما هو)
    useEffect(() => {
        const setupUserAndLoadVideo = (foundUser) => {
            if (foundUser && foundUser.id) { 
                setUser(foundUser); 
            } else { 
                setError("خطأ: لا يمكن التعرف على المستخدم."); 
                return; 
            }

            if (videoId) {
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
                        setStreamUrl(data.streamUrl);
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

    // (دالة التحميل - تبقى كما هي)
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

    // (باقي الكود زي ما هو بالظبط)
    if (error) { return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>; }
    if (!user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري التحقق...</h1></div>; }
    
    const plyrSource = {
      type: 'video',
      title: videoTitle,
      sources: [], 
    };
    
    const plyrOptions = {
        controls: [
            'play-large', 'play', 'progress', 'current-time',
            'mute', 'volume', 'settings', 'fullscreen'
        ],
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
                
                {/* [ ✅✅✅ هذا هو السطر الأهم في الحل البديل ] */}
                {/* (جلب المكتبة مباشرة من CDN بدلاً من npm) */}
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.14"></script>
                
            </Head>

            <div className="player-wrapper" ref={playerWrapperRef}>
                
                {!streamUrl && (
                     <div className="message-container" style={{position: 'absolute', height: '100%'}}>
                         <h1>جاري تحميل الفيديو...</h1>
                     </div>
                )}
                
                <Plyr
                  ref={plyrInstanceRef} 
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
