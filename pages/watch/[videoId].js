// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (استيراد الستايل فقط)
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
    
    // مراجع للعناصر
    const videoRef = useRef(null);
    const plyrInstance = useRef(null);
    const hlsInstance = useRef(null);

    // 1. منطق التشغيل (HLS + Plyr) - الطريقة اليدوية المضمونة
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const initPlayer = () => {
            const video = videoRef.current;
            
            // إعدادات Plyr الافتراضية
            const defaultOptions = {
                controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
                settings: ['quality', 'speed'],
                // (مهم) إعداد أولي للجودة لتجهيز القائمة
                quality: { default: 0, options: [0], forced: true, onChange: (e) => updateQuality(e) }
            };

            if (window.Hls && window.Hls.isSupported()) {
                const hls = new window.Hls({
                    maxBufferLength: 30,
                    maxMaxBufferLength: 600,
                });
                hlsInstance.current = hls;

                hls.loadSource(streamUrl);
                hls.attachMedia(video);

                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                    // 1. استخراج الجودات من HLS
                    const availableQualities = hls.levels.map((l) => l.height);
                    // 2. إضافة خيار Auto (0)
                    availableQualities.unshift(0);

                    // 3. تحديث إعدادات Plyr بالجودات الحقيقية
                    defaultOptions.quality = {
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
                        }
                    };
                    
                    // 4. تشغيل Plyr الآن (بعد تجهيز الجودات)
                    if (!plyrInstance.current) {
                        // @ts-ignore
                        const Plyr = window.Plyr;
                        const player = new Plyr(video, defaultOptions);
                        
                        // تسمية Auto
                        player.config.i18n = { 
                            ...player.config.i18n, 
                            qualityLabel: { 0: 'Auto' } 
                        };
                        
                        plyrInstance.current = player;
                    }
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
                // دعم سفاري (Native HLS)
                video.src = streamUrl;
                // @ts-ignore
                const Plyr = window.Plyr;
                plyrInstance.current = new Plyr(video, defaultOptions);
            }
        };

        // تحميل مكتبة Plyr و HLS من الـ CDN إذا لم تكن موجودة
        if (!window.Plyr || !window.Hls) {
             // ننتظر قليلاً حتى يتم تحميل السكربتات من الـ Head
             setTimeout(initPlayer, 500);
        } else {
             initPlayer();
        }

        // تنظيف عند الخروج
        return () => {
            if (hlsInstance.current) hlsInstance.current.destroy();
            if (plyrInstance.current) plyrInstance.current.destroy();
        };

    }, [streamUrl]);


    // 2. جلب البيانات (نفس الكود السابق)
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

    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                {/* تحميل المكتبات من CDN لضمان العمل والتوافق */}
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8"></script>
                <script src="https://cdn.plyr.io/3.7.8/plyr.js"></script>
                <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
            </Head>

            <div className="player-wrapper">
                {/* عنصر الفيديو الخام الذي سيتصل به HLS و Plyr */}
                <video 
                    ref={videoRef} 
                    className="plyr-video" 
                    crossOrigin="anonymous" 
                    playsInline 
                    controls
                >
                </video>
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
                
                /* جعل الفيديو يملأ الحاوية */
                video { width: 100%; height: 100%; }

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
