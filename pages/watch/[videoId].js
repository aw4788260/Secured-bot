// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// استيراد Plyr بدون SSR
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
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
    
    // مراجع
    const ref = useRef(null); // مرجع لـ Plyr

    // 1. تهيئة HLS وربطها بـ Plyr
    useEffect(() => {
        // شرط: الرابط موجود + المشغل تم بناؤه (ref.current موجود)
        if (!streamUrl || !ref.current) return;

        const player = ref.current.plyr;
        
        // (تأكد أننا لم نقم بالربط مسبقاً لتجنب التكرار)
        if (player.hlsAttached) return;

        const videoElement = player.media; // عنصر الفيديو الأصلي

        if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
            });
            
            hls.loadSource(streamUrl);
            hls.attachMedia(videoElement);
            player.hlsAttached = true; // علامة لمنع التكرار

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                // 1. استخراج الجودات من HLS
                const availableQualities = hls.levels.map((l) => l.height);
                // إضافة خيار Auto (0)
                availableQualities.unshift(0);

                // 2. [الحيلة لإظهار الزر] تحديث إعدادات Plyr ديناميكياً
                player.config.quality = {
                    default: 0,
                    options: availableQualities,
                    forced: true, // يجبر القائمة على الظهور
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

                // 3. تحديث النصوص (تسمية Auto)
                player.config.i18n = { 
                    ...player.config.i18n, 
                    qualityLabel: { 0: 'Auto' } 
                };

                // 4. [هام] إعادة تعيين المصدر "وهمياً" لتطبيق التغييرات أو تعيين الجودة
                // Plyr أحياناً يحتاج "نكزة" ليحدث الواجهة
                player.quality = 0; 
                
                console.log("Plyr qualities updated:", availableQualities);
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

        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // دعم سفاري (Native HLS)
            videoElement.src = streamUrl;
        }
    }, [streamUrl]); // يعمل عند توفر الرابط


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

    // إعدادات Plyr المبدئية
    const plyrOptions = {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['quality', 'speed'],
        // نضع قيمة افتراضية للجودة "لحجز المكان" حتى يتم التحديث
        quality: { default: 0, options: [0], forced: true, onChange: ()=>{} }
    };

    // مصدر الفيديو (مهم لـ Plyr)
    const plyrSource = {
        type: 'video',
        title: videoTitle,
        // نضع الرابط هنا أيضاً، مع أن HLS سيقوم بتحميله يدوياً، لكن هذا يفيد Plyr في التهيئة
        sources: [{ src: streamUrl, type: 'application/x-mpegURL' }]
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                {/* تحميل HLS من CDN */}
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8"></script>
            </Head>

            <div className="player-wrapper">
                <Plyr 
                    ref={ref} 
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
                
                /* التوسيط */
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
                .plyr { height: 100%; width: 100%; }

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
                
                /* إصلاحات Plyr */
                .player-wrapper :global(.plyr--video) { height: 100%; }
                .player-wrapper:fullscreen { max-width: none; width: 100%; height: 100%; }
            `}</style>
        </div>
    );
}
