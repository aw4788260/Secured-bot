// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// مكون العلامة المائية كما هو
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
            if (watermarkIntervalRef.current) clearInterval(watermarkIntervalRef.current); 
        };
    }, [user]);

    return (
        <div className="watermark" style={{ 
            position: 'absolute', top: watermarkPos.top, left: watermarkPos.left,
            zIndex: 15, pointerEvents: 'none', padding: '4px 8px', 
            background: 'rgba(0, 0, 0, 0.7)', color: 'white', 
            fontSize: 'clamp(10px, 2.5vw, 14px)', borderRadius: '4px',
            fontWeight: 'bold', transition: 'top 2s ease-in-out, left 2s ease-in-out',
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
    const [videoTitle, setVideoTitle] = useState("جاري التحميل...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    // [جديد] حالة للتحكم في ظهور البلاير بعد تحميل الجودات
    const [isReady, setIsReady] = useState(false);
    
    const plyrRef = useRef(null);
    const hlsRef = useRef(null);

    // ##############################
    //        تفعيل الجودة
    // ##############################
    const initHLSPlayer = useCallback(() => {
        if (!streamUrl) return;

        const video = plyrRef.current?.plyr?.media;
        const player = plyrRef.current?.plyr;

        if (!video || !player) {
            // محاولة أخرى إذا لم يكن البلاير جاهزاً
            setTimeout(initHLSPlayer, 200);
            return;
        }

        if (window.Hls && window.Hls.isSupported()) {
            // إذا كان هناك HLS سابق، نقوم بتدميره لمنع التداخل
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }

            const hls = new window.Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                enableWorker: true,
            });

            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                // 1. استخراج الجودات
                const availableQualities = hls.levels.map((l) => l.height);
                availableQualities.unshift(0); // إضافة Auto

                // 2. إعداد الكونفيج
                player.config.quality = {
                    default: 0,
                    options: availableQualities,
                    forced: true,
                    onChange: (newQuality) => {
                        if (newQuality === 0) {
                            hls.currentLevel = -1; // Auto
                        } else {
                            hls.levels.forEach((level, levelIndex) => {
                                if (level.height === newQuality) {
                                    hls.currentLevel = levelIndex;
                                }
                            });
                        }
                    },
                };

                // 3. ضبط التسميات
                player.config.i18n = { 
                    ...player.config.i18n, 
                    qualityLabel: { 0: 'Auto' } 
                };

                // 4. تفعيل الجودة يدوياً لتحديث الواجهة
                player.quality = 0; 

                // [جديد] الآن أصبح كل شيء جاهزاً، نظهر البلاير
                setIsReady(true);
            });

            // معالجة الأخطاء
            hls.on(window.Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                   // في حالة الخطأ القاتل، نظهر البلاير على أي حال حتى لا يعلق المستخدم
                   setIsReady(true);
                }
            });

        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari IOS
            video.src = streamUrl;
            setIsReady(true); // نظهر البلاير مباشرة في سفاري
        } else {
             // Fallback
             setIsReady(true);
        }
    }, [streamUrl]);

    useEffect(() => {
        // عند تغيير الرابط، نعيد حالة الجاهزية للصفر
        setIsReady(false);
        if (streamUrl) initHLSPlayer();
        
        // تنظيف عند الخروج
        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [streamUrl, initHLSPlayer]);


    // ##############################
    //        جلب البيانات
    // ##############################
    useEffect(() => {
        const setupUser = (u) => {
            if (u && u.id) setUser(u);
            else setError("خطأ: لا يمكن التعرف على المستخدم.");
        };

        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        const urlFirstName = params.get("firstName");

        if (urlUserId) {
            setupUser({ id: urlUserId, first_name: urlFirstName || "User" });
            if (window.Android) setIsNativeAndroid(true);
        } 
        else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u);
            else setError("يرجى الفتح من تليجرام.");
        } 
        else {
            setError("يرجى الفتح من التطبيق المخصص.");
        }

        if (videoId) {
            setStreamUrl(null); // تصفير الرابط القديم
            setIsReady(false); // إخفاء البلاير
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    setStreamUrl(data.streamUrl);
                    setYoutubeId(data.youtube_video_id);
                    setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);


    const handleDownloadClick = () => {
        if (!youtubeId) return alert("انتظر..");
        if (isNativeAndroid) {
            try { window.Android.downloadVideo(youtubeId, videoTitle); } 
            catch { alert("خطأ في الاتصال."); }
        } else {
            alert("متاح فقط في التطبيق.");
        }
    };

    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;


    const plyrSource = {
        type: "video",
        title: videoTitle,
        sources: [{ src: streamUrl, type: "application/x-mpegURL" }]
    };

    const plyrOptions = {
        controls: [
            "play-large","play","progress","current-time",
            "mute","volume","settings","fullscreen"
        ],
        // [تعديل] إضافة quality هنا ضروري حتى لو فارغ ليحجز مكاناً في القائمة
        settings: ["quality", "speed"], 
        fullscreen: { enabled: true, fallback: true, iosNative: true }
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8"></script>
            </Head>

            <div className="player-wrapper">
                {/* [جديد] شاشة تحميل تظهر فوق البلاير حتى تجهز الجودات */}
                {!isReady && (
                    <div className="player-loader">
                        <div className="spinner"></div>
                        <p>جاري تجهيز الجودات...</p>
                    </div>
                )}

                {/* البلاير موجود في DOM دائماً لكي يعمل HLS لكن قد يكون مخفياً خلف اللودر */}
                <Plyr 
                    ref={plyrRef}
                    source={plyrSource}
                    options={plyrOptions}
                />
                <Watermark user={user} />
            </div>

            {isNativeAndroid && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info">
                <p>برمجة وتطوير: A7MeD WaLiD</p>
                <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank">اضغط هنا</a></p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; }
                
                .page-container { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center;
                    min-height: 100vh; 
                    padding: 10px; 
                    position: relative;
                }
                
                .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; }
                
                .player-wrapper { 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: 16/9; 
                    background: #000; 
                    position: relative; 
                    margin-bottom: 0;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }

                /* [جديد] تصميم شاشة انتظار الجودة */
                .player-loader {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #000;
                    z-index: 20; /* أعلى من البلاير والعلامة المائية */
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    color: #fff;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #38bdf8;
                    animation: spin 1s ease-in-out infinite;
                    margin-bottom: 10px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .download-button-native { 
                    width: 100%; 
                    max-width: 900px; 
                    padding: 15px; 
                    background: #38bdf8; 
                    border: none; 
                    border-radius: 8px; 
                    font-weight: bold; 
                    cursor: pointer; 
                    color: #111; 
                    margin-top: 20px; 
                }

                .developer-info {
                    position: absolute;
                    bottom: 10px;
                    width: 100%;
                    text-align: center;
                    font-size: 0.85rem;
                    color: #777;
                }
                .developer-info a { color: #38bdf8; text-decoration: none; }
                
                .player-wrapper :global(.plyr--video) { height: 100%; }
                .player-wrapper:fullscreen { max-width: none; width: 100%; height: 100%; }
            `}</style>
        </div>
    );
}
