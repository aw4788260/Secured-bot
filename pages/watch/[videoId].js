// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// [ ✅✅✅ بداية الإصلاح ]
import dynamic from 'next/dynamic';
// 1. تحميل المشغل "ديناميكياً" ومنع تشغيله على السيرفر
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
// 2. استيراد الـ CSS بشكل عادي
import 'plyr/dist/plyr.css';
// [ ✅✅✅ نهاية الإصلاح ]

// (تم حذف import react-youtube)

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const [youtubeId, setYoutubeId] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    
    // [ ✅✅ جديد: حالة لتخزين عنوان الفيديو ]
    const [videoTitle, setVideoTitle] = useState("جاري تحميل العنوان...");
    // [ ✅✅ جديد: حالة للتحقق من وجود الجسر (للأندرويد) ]
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);

    // [ ✅✅ الإبقاء على كود العلامة المائية ]
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const watermarkIntervalRef = useRef(null);

    // [ 🛑🛑 حذف: كل الـ states الخاصة بالمشغل المخصص ]
    // (تم حذف: isPlaying, playerRef, currentTime, duration, showSeekIcon, 
    // isSeeking, progressBarRef, playbackRate, videoQuality, isFullscreen ...إلخ)
    
    const playerWrapperRef = useRef(null); // (سنبقيه لزر التحميل)


    useEffect(() => {
        
        // (دالة مساعدة لضبط المستخدم وبدء تحميل الفيديو - تبقى كما هي)
        const setupUserAndLoadVideo = (foundUser) => {
            if (foundUser && foundUser.id) { 
                setUser(foundUser); 
            } else { 
                setError("خطأ: لا يمكن التعرف على المستخدم."); 
                return; 
            }

            if (videoId) {
                // (الكود الحالي الخاص بك يعمل بشكل مثالي مع Plyr)
                fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                    .then(res => { if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو'); return res.json(); })
                    .then(data => {
                        setYoutubeId(data.youtube_video_id);
                        // (يمكنك إضافة حقل "العنوان" للـ API لإرجاعه هنا)
                        // setVideoTitle(data.title || "فيديو"); 
                    })
                    .catch(err => setError(err.message));
            }
        };

        // (منطق التحقق من المستخدم - يبقى كما هو)
        // --- [ ✅✅ بداية المنطق الجديد للتحقق (المعدل) ] ---
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        // [ الحالة 1: مستخدم البرنامج (APK) ]
        if (urlUserId && urlUserId.trim() !== '') {
            const apkUser = { 
                id: urlUserId, 
                first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User"
            };
            setupUserAndLoadVideo(apkUser); // (سماح بالدخول)

            // [ ✅ جديد: التحقق من وجود الجسر ]
            // "Android" هو الاسم الذي سنعرفه في جافا
            if (typeof window.Android !== 'undefined' && typeof window.Android.downloadVideo === 'function') {
                setIsNativeAndroid(true);
            }

        // [ الحالة 2: مستخدم تليجرام ميني آب ]
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const platform = window.Telegram.WebApp.platform;
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;

            if (!miniAppUser || !miniAppUser.id) {
                setError("لا يمكن التعرف على هويتك من تليجرام.");
                return;
            }

            // [ ✅ تعديل: السماح لـ (iOS, macOS, tdesktop) مباشرة ]
            if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
                // (سماح بالدخول للآيفون، الماك، والويندوز/لينكس ديسكتوب)
                setupUserAndLoadVideo(miniAppUser);
            } else {
                // [ الحالة 2ب: المنصات الأخرى (مثل android, web) يجب التحقق من الأدمن ]
                fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
                    .then(res => res.json())
                    .then(adminData => {
                        if (adminData.isAdmin) {
                            // (سماح بالدخول للأدمن على أي منصة)
                            setupUserAndLoadVideo(miniAppUser);
                        } else {
                            // (منع الدخول لغير الأدمن على هذه المنصات)
                            setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                        }
                    })
                    .catch(err => {
                        setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
                    });
            }
        // [ الحالة 3: مستخدم متصفح عادي (منع الدخول) ]
        } else {
             setError('الرجاء الفتح من البرنامج المخصص (للأندرويد) أو من تليجرام.');
             return;
        }
        // --- [ ✅✅ نهاية المنطق الجديد ] ---


        // [ ✅✅ تبسيط: الإبقاء على عداد العلامة المائية فقط ]
        watermarkIntervalRef.current = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10;
            const newLeft = Math.floor(Math.random() * 70) + 10;
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000);
        
        // (تم حذف كل الأكواد الخاصة بـ progressInterval و handleFullscreenChange)

        return () => { 
            clearInterval(watermarkIntervalRef.current); 
            // (تم حذف كل الـ event listeners)
        };
    }, [videoId]); // (تم تبسيط الـ dependencies)

    // [ 🛑🛑 حذف: كل دوال التحكم بالمشغل ]
    // (تم حذف: formatQualityLabel, handlePlayPause, handleSeek, onPlayerReady, 
    // handleOnPlay, calculateSeekTime, handleScrubStart, handleScrubbing, 
    // handleScrubEnd, handleSetPlaybackRate, formatTime, handleSetQuality, 
    // handleActualQualityChange, handleFullscreen)

    // [ ✅✅ الإبقاء على دالة التحميل الخاصة بالأندرويد ]
    const handleDownloadClick = () => {
        // (ملاحظة: نحتاج لجلب العنوان بطريقة أخرى)
        // (سنقوم بتعيين العنوان يدوياً هنا، أو يمكنك جلب العنوان بـ API call منفصل)
        const fakeVideoTitle = videoTitle || "video"; // (يفضل جلب العنوان مع get-video-id API)
        
        if (!youtubeId) {
            alert("بيانات الفيديو غير جاهزة بعد، يرجى الانتظار ثانية.");
            return;
        }

        if (isNativeAndroid) {
            try {
                // (استخدام العنوان الذي جلبناه)
                window.Android.downloadVideo(youtubeId, fakeVideoTitle);
            } catch (e) {
                console.error("Error calling native bridge:", e);
                alert("حدث خطأ أثناء الاتصال بالتطبيق.");
            }
        } else {
            alert("التحميل الأوفلاين متاح فقط من داخل تطبيق الأندرويد الرسمي.");
        }
    };


    if (error) { return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>; }
    if (!youtubeId || !user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>; }
    
    // [ ✅✅ جديد: إعدادات مشغل Plyr ]
    const plyrSource = {
      type: 'video',
      sources: [
        {
          src: youtubeId,
          provider: 'youtube', // (تحديد المصدر: يوتيوب)
        },
      ],
    };
    
    const plyrOptions = {
        controls: [
            'play-large', 'play', 'progress', 'current-time',
            'mute', 'volume', 'settings', 'fullscreen'
        ],
        settings: ['quality', 'speed'],
        // (لإخفاء أزرار يوتيوب الأصلية والسماح لـ Plyr بالتحكم)
        youtube: {
            rel: 0, // (عدم عرض فيديوهات مقترحة)
            showinfo: 0, // (إخفاء معلومات الفيديو)
            modestbranding: 1, // (إخفاء لوجو يوتيوب)
            controls: 0, // (إخفاء الأزرار الأصلية)
        }
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div className="player-wrapper" ref={playerWrapperRef}>
                
                {/* [ ✅✅✅ بداية: استبدال المشغل ] */}
                <Plyr
                  source={plyrSource}
                  options={plyrOptions}
                />
                {/* [ ✅✅✅ نهاية: استبدال المشغل ] */}

                {/* [ ✅✅ الإبقاء على العلامة المائية ولكن تبسيطها ] */}
                {/* (تم حذف كل الأزرار المخصصة من هنا) */}
                <div className="watermark" style={{ 
                    position: 'absolute', // (يجب أن تكون absolute)
                    top: watermarkPos.top, 
                    left: watermarkPos.left,
                    zIndex: 15, // (أعلى من المشغل)
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
            </div>

            {/* [ ✅✅ الإبقاء على زر التحميل ] */}
            {isNativeAndroid && (
                <button 
                    onClick={handleDownloadClick} 
                    className="download-button-native"
                >
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}
            {/* [ نهاية الزر الجديد ] */}


            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
              <p>برمجة وتطوير: A7MeD WaLiD</p>
              <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>

            {/* [ ✅✅ تبسيط الـ CSS: حذف كل الأكواد الخاصة بالأزرار القديمة ] */}
            <style jsx global>{`
                body { margin: 0; overscroll-behavior: contain; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 10px; box-sizing: border-box; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; padding: 20px; text-align: center; }
                
                /* (حاوية المشغل الرئيسية) */
                .player-wrapper { 
                    position: relative; 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: 16 / 7; 
                    background: #111; 
                    border-radius: 8px; /* (جديد: ليتناسب مع Plyr) */
                    overflow: hidden; /* (جديد: ليتناسب مع Plyr) */
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
                
                /* (مشغل Plyr سيملأ الحاوية) */
                .player-wrapper .plyr {
                    width: 100%;
                    height: 100%;
                }

                /* (تم حذف كل كلاسات الأزرار المخصصة مثل: 
                   .controls-overlay, .interaction-grid, .seek-zone, 
                   .play-pause-zone, .bottom-controls, .extra-controls, 
                   .time-display, .progress-bar-container, .seek-indicator, 
                   .fullscreen-btn) */
                
                /* [ ✅ جديد: تنسيق زر التحميل (كما كان) ] */
                .download-button-native {
                    background-color: #38bdf8; /* لون أزرق مميز */
                    color: #111827; /* لون النص غامق */
                    font-weight: bold;
                    padding: 12px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 15px 0 0 0;
                    display: block; /* اجعله يظهر */
                    width: 100%;
                    max-width: 900px;
                    transition: background-color 0.3s ease;
                }
                .download-button-native:hover {
                    background-color: #7dd3fc; /* لون أفتح عند المرور */
                }
            `}</style>
        </div>
    );
}
