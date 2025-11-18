import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

// --- مكون العلامة المائية ---
const Watermark = ({ user }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setPos({ 
                top: `${Math.floor(Math.random() * 80) + 10}%`, 
                left: `${Math.floor(Math.random() * 80) + 10}%` 
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div style={{ 
            position: 'absolute', top: pos.top, left: pos.left,
            zIndex: 20, pointerEvents: 'none', padding: '4px 8px', 
            background: 'rgba(0, 0, 0, 0.6)', color: 'white', 
            fontSize: 'clamp(10px, 2.5vw, 14px)', borderRadius: '4px',
            fontWeight: 'bold', transition: 'all 2s ease', whiteSpace: 'nowrap'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // --- 1. جلب البيانات وتشغيل المشغل ---
    useEffect(() => {
        const setupUser = (u) => { if (u && u.id) setUser(u); else setError("خطأ: لا يمكن التعرف على المستخدم."); };
        
        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        if (urlUserId) {
            setupUser({ id: urlUserId, first_name: params.get("firstName") || "User" });
            if (window.Android) setIsNativeAndroid(true);
        } else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u); else setError("يرجى الفتح من تليجرام.");
        }

        if (videoId && artRef.current) {
            // تصفير المشغل القديم لتجنب التداخل
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
                playerInstance.current = null;
            }

            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
                .then(data => {
                    let qualities = data.availableQualities || [];
                    if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                    
                    // ترتيب الجودات (الأعلى أولاً)
                    qualities = qualities.sort((a, b) => b.quality - a.quality);

                    // تحويل الجودات لتنسيق Artplayer
                    const qualityList = qualities.map((q, index) => ({
                        default: index === 0,
                        html: `${q.quality}p`,
                        url: q.url,
                    }));

                    // تهيئة Artplayer
                    const art = new Artplayer({
                        container: artRef.current,
                        url: qualityList[0].url,
                        quality: qualityList,
                        title: data.videoTitle || "مشاهدة الدرس",
                        volume: 0.7,
                        isLive: false,
                        muted: false,
                        autoplay: false, // سنجعل HLS يقوم بالتشغيل
                        autoSize: true,
                        autoMini: true,
                        screenshot: true,
                        setting: true,
                        loop: false,
                        flip: true,
                        playbackRate: true,
                        aspectRatio: true,
                        fullscreen: true,
                        fullscreenWeb: true,
                        miniProgressBar: true,
                        mutex: true,
                        backdrop: true,
                        playsInline: true,
                        theme: '#38bdf8',
                        lang: 'ar',
                        
                        // --- إعدادات HLS المتقدمة (الحل هنا) ---
                        customType: {
                            m3u8: function (video, url, art) {
                                if (art.hls) art.hls.destroy();

                                if (Hls.isSupported()) {
                                    const hls = new Hls({
                                        maxBufferLength: 30,
                                        enableWorker: true,
                                        // [هام] تخطي مشاكل CORS ومحاكاة إعدادات Plyr
                                        xhrSetup: function (xhr) { 
                                            xhr.withCredentials = false; 
                                            // إضافة هذا السطر ساعد سابقاً
                                            xhr.setRequestHeader('Referer', 'https://www.youtube.com/'); 
                                        }
                                    });
                                    
                                    hls.loadSource(url);
                                    hls.attachMedia(video);
                                    
                                    // 1. التشغيل فور الجاهزية
                                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                        art.notice.show = `جاري تشغيل جودة ${art.quality.find(q => q.url === url)?.html || 'Auto'}`;
                                        video.play().catch(() => console.log("Autoplay blocked"));
                                    });

                                    // 2. معالجة الأخطاء (لمنع التعليق)
                                    hls.on(Hls.Events.ERROR, (event, data) => {
                                        if (data.fatal) {
                                            switch (data.type) {
                                                case Hls.ErrorTypes.NETWORK_ERROR:
                                                    // محاولة الإنعاش عند فشل الشبكة
                                                    console.log("Network error, recovering...");
                                                    hls.startLoad();
                                                    break;
                                                case Hls.ErrorTypes.MEDIA_ERROR:
                                                    console.log("Media error, recovering...");
                                                    hls.recoverMediaError();
                                                    break;
                                                default:
                                                    // خطأ قاتل، تدمير وعرض رسالة
                                                    art.notice.show = 'حدث خطأ في التشغيل، يرجى تغيير الجودة أو التحديث';
                                                    hls.destroy();
                                                    break;
                                            }
                                        }
                                    });

                                    art.hls = hls;

                                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                    video.src = url;
                                } else {
                                    art.notice.show = 'المتصفح لا يدعم تشغيل الفيديو';
                                }
                            },
                        },
                    });

                    // تنظيف الذاكرة عند التدمير
                    art.on('destroy', () => {
                        if (art.hls) art.hls.destroy();
                    });

                    playerInstance.current = art;
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        }

        return () => {
            if (playerInstance.current) playerInstance.current.destroy(false);
        };
    }, [videoId]);

    // تحميل للأندرويد
    const handleDownloadClick = () => {
        if (isNativeAndroid) {
             alert("التحميل متاح من داخل التطبيق فقط");
        }
    };

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;
    if (loading) return <div className="center-msg"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                {/* هذا التاج ضروري جداً لروابط جوجل */}
                <meta name="referrer" content="no-referrer" />
            </Head>

            <div className="player-wrapper">
                <div ref={artRef} className="artplayer-app"></div>
                {user && <Watermark user={user} />}
            </div>

            {isNativeAndroid && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info">
                <p>برمجة وتطوير: A7MeD WaLiD</p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; position: relative; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; }
                .player-wrapper { width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .artplayer-app { width: 100%; height: 100%; }
                .download-button-native { width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }
            `}</style>
        </div>
    );
}
