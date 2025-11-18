// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

import 'plyr/dist/plyr.css';

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
        return () => { if (watermarkIntervalRef.current) clearInterval(watermarkIntervalRef.current); };
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
    
    const videoRef = useRef(null);
    const plyrInstance = useRef(null);
    const hlsInstance = useRef(null);

    // 1. بناء المشغل (Plyr) فوراً (حتى لو مفيش رابط لسه)
    useEffect(() => {
        if (!videoRef.current || plyrInstance.current) return;

        // ننتظر تحميل مكتبة Plyr من الـ CDN
        const initPlyr = () => {
            if (window.Plyr) {
                // بناء المشغل بإعدادات مبدئية فارغة
                const player = new window.Plyr(videoRef.current, {
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
                    settings: ['quality', 'speed'],
                    // جودة وهمية لحجز المكان في القائمة
                    quality: { default: 0, options: [0], forced: true, onChange: ()=>{} },
                    // إعدادات أخرى
                    hideControls: false,
                    clickToPlay: true,
                });
                
                // تسمية الزر "جاري التحميل..." مؤقتاً
                player.config.i18n.qualityLabel = { 0: 'Loading...' };
                
                plyrInstance.current = player;
            } else {
                setTimeout(initPlyr, 100);
            }
        };

        initPlyr();

        return () => {
            if (plyrInstance.current) plyrInstance.current.destroy();
        };
    }, []); // يعمل مرة واحدة عند فتح الصفحة


    // 2. تفعيل HLS وحقن الإعدادات (لما الرابط يوصل)
    useEffect(() => {
        if (!streamUrl || !plyrInstance.current) return;

        const player = plyrInstance.current;
        const video = videoRef.current;

        if (window.Hls && window.Hls.isSupported()) {
            if (hlsInstance.current) hlsInstance.current.destroy(); // تنظيف القديم لو وجد

            const hls = new window.Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
            });
            hlsInstance.current = hls;

            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                // استخراج الجودات
                const availableQualities = hls.levels.map((l) => l.height);
                availableQualities.unshift(0); // Auto

                // تحديث إعدادات Plyr الحالية (Runtime Update)
                player.config.quality = {
                    default: 0,
                    options: availableQualities,
                    forced: true,
                    onChange: (newQuality) => {
                        if (newQuality === 0) {
                            hls.currentLevel = -1;
                        } else {
                            hls.levels.forEach((level, levelIndex) => {
                                if (level.height === newQuality) {
                                    hls.currentLevel = levelIndex;
                                }
                            });
                        }
                    }
                };

                // تحديث النصوص
                player.config.i18n.qualityLabel = { 0: 'Auto' };
                
                // إجبار Plyr على تحديث الواجهة
                // (تعيين الجودة لنفسها يجبره على إعادة رسم القائمة)
                player.quality = 0;
                
                // تشغيل الفيديو تلقائياً إذا أردت
                // player.play();
            });

            hls.on(window.Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                        default: hls.destroy(); break;
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // سفاري
            video.src = streamUrl;
        }

    }, [streamUrl]); // يعمل لما الرابط يتغير


    // 3. جلب البيانات
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
            if (typeof window.Android !== 'undefined') setIsNativeAndroid(true);
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if(u) setupUser(u); else setError("يرجى الفتح من تليجرام.");
        } else {
            setError("يرجى الفتح من التطبيق المخصص.");
        }

        if (videoId) {
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
        } else { alert("متاح فقط في التطبيق."); }
    };

    // فقط خطأ المستخدم يمنع العرض، أما الفيديو فنسمح ببناء المشغل
    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user) return <div className="message-container"><h1>جاري التحقق...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8"></script>
                <script src="https://cdn.plyr.io/3.7.8/plyr.js"></script>
                <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
            </Head>

            <div className="player-wrapper">
                {/* هذا العنصر سيتحول لمشغل Plyr فوراً */}
                <video 
                    ref={videoRef} 
                    className="plyr-video" 
                    crossOrigin="anonymous" 
                    playsInline 
                    controls
                    // صورة مصغرة (اختياري)
                    poster="/placeholder.png" 
                >
                </video>
                
                {/* شاشة تحميل تظهر فوق المشغل حتى يصل الرابط */}
                {!streamUrl && (
                    <div className="player-loader-overlay">
                        <div className="spinner"></div>
                        <p>جاري جلب الفيديو...</p>
                    </div>
                )}

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
                    display: flex; flex-direction: column; align-items: center; 
                    justify-content: center; min-height: 100vh; padding: 10px; 
                    position: relative; 
                }
                .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; }
                
                .player-wrapper { 
                    width: 100%; max-width: 900px; aspect-ratio: 16/9; 
                    background: #000; position: relative; margin: 0;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden;
                }
                
                video { width: 100%; height: 100%; }

                /* شاشة التحميل فوق المشغل */
                .player-loader-overlay {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.8);
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    z-index: 10; /* فوق الفيديو، تحت العلامة المائية */
                }
                .spinner {
                    width: 40px; height: 40px;
                    border: 4px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #38bdf8;
                    animation: spin 1s ease-in-out infinite;
                    margin-bottom: 10px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .download-button-native { 
                    width: 100%; max-width: 900px; padding: 15px; 
                    background: #38bdf8; border: none; border-radius: 8px; 
                    font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; 
                }

                .developer-info {
                    position: absolute; bottom: 10px; width: 100%; 
                    text-align: center; font-size: 0.85rem; color: #777;
                }
                .developer-info a { color: #38bdf8; text-decoration: none; }
                
                .player-wrapper :global(.plyr--video) { height: 100%; }
                .player-wrapper:fullscreen { max-width: none; width: 100%; height: 100%; }
            `}</style>
        </div>
    );
}
