import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const [loading, setLoading] = useState(true);      
    const [libsLoaded, setLibsLoaded] = useState(false); 
    
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // 1. إعداد المستخدم
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
    }, []);

    // 2. تشغيل المشغل
    useEffect(() => {
        if (!videoId || !libsLoaded || !user) return; 

        if (playerInstance.current) {
            playerInstance.current.destroy(false);
            playerInstance.current = null;
        }

        setLoading(true);

        fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
            .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
            .then(data => {
                let qualities = data.availableQualities || [];
                if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                
                qualities = qualities.sort((a, b) => b.quality - a.quality);

                const qualityList = qualities.map((q, index) => ({
                    default: index === 0,
                    html: `${q.quality}p`,
                    url: q.url,
                }));

                if (!artRef.current || !window.Artplayer) return;

                // --- إعداد Artplayer ---
                const art = new window.Artplayer({
                    container: artRef.current,
                    url: qualityList[0].url,
                    quality: qualityList,
                    title: data.videoTitle || "مشاهدة الدرس",
                    volume: 0.7,
                    isLive: false,
                    muted: false,
                    autoplay: false,
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
                    
                    // [هام] إيقاف أي سلوك افتراضي للنقر المزدوج لتفعيل الكود الخاص بنا
                    // (بعض النسخ تدعم هذا الخيار لتعطيل تكبير الشاشة بالنقر)
                    moreVideoAttr: {
                        playsInline: true,
                        'webkit-playsinline': true,
                    },

                    // إضافة العلامة المائية
                    layers: [
                        {
                            html: `<div class="watermark-layer">${user.first_name} (${user.id})</div>`,
                            style: {
                                position: 'absolute',
                                top: '10%',
                                left: '10%',
                                pointerEvents: 'none',
                                zIndex: 20,
                            },
                        }
                    ],
                    
                    customType: {
                        m3u8: function (video, url, art) {
                            if (art.hls) art.hls.destroy();
                            if (window.Hls && window.Hls.isSupported()) {
                                const hls = new window.Hls({
                                    maxBufferLength: 30,
                                    enableWorker: true,
                                    xhrSetup: function (xhr) { xhr.withCredentials = false; }
                                });
                                hls.loadSource(url);
                                hls.attachMedia(video);
                                hls.on(window.Hls.Events.ERROR, (event, data) => {
                                    if (data.fatal) {
                                        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                                            hls.destroy();
                                            video.src = url;
                                        } else {
                                            hls.destroy();
                                        }
                                    }
                                });
                                art.hls = hls;
                            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                video.src = url;
                            }
                        },
                    },
                });

                // --- [1] قتل نظام الإشعارات تماماً ---
                art.notice.show = function() { 
                    // تم التعطيل: لن يظهر أي إشعار نصي بعد الآن
                };

                // --- [2] برمجة ميزة النقر المزدوج (YouTube Style) ---
                art.on('ready', () => {
                    // نستخدم طبقة "القناع" (Mask) لأنها التي تستقبل النقرات
                    const mask = art.template.$mask; 
                    let lastTapTime = 0;

                    mask.addEventListener('touchstart', (e) => {
                        const currentTime = new Date().getTime();
                        const tapLength = currentTime - lastTapTime;
                        
                        // إذا كان الفرق بين النقرتين أقل من 300 ملي ثانية (نقر مزدوج)
                        if (tapLength < 300 && tapLength > 0) {
                            const touchX = e.touches[0].clientX; // مكان النقر
                            const playerWidth = mask.clientWidth; // عرض المشغل

                            // إذا كان النقر في الثلث الأيسر (تأخير)
                            if (touchX < playerWidth * 0.35) {
                                art.backward = 10;
                                // وميض بسيط للتأكيد (اختياري)
                                showTapFeedback(art, "Back");
                            }
                            // إذا كان النقر في الثلث الأيمن (تقديم)
                            else if (touchX > playerWidth * 0.65) {
                                art.forward = 10;
                                showTapFeedback(art, "Forward");
                            }
                            
                            // منع السلوك الافتراضي (مثل التكبير) عند النقر المزدوج
                            e.preventDefault();
                        }
                        lastTapTime = currentTime;
                    });
                });

                // تحريك العلامة المائية
                const moveWatermark = () => {
                    const layer = art.template.$player.querySelector('.watermark-layer');
                    if (layer) {
                        const newTop = Math.floor(Math.random() * 80) + 10;
                        const newLeft = Math.floor(Math.random() * 80) + 10;
                        layer.style.top = `${newTop}%`;
                        layer.style.left = `${newLeft}%`;
                    }
                };
                
                const watermarkInterval = setInterval(moveWatermark, 5000);

                art.on('destroy', () => {
                    if (art.hls) art.hls.destroy();
                    clearInterval(watermarkInterval);
                });

                playerInstance.current = art;
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });

        return () => {
            if (playerInstance.current) playerInstance.current.destroy(false);
        };
    }, [videoId, libsLoaded]); 

    // دالة مساعدة لإظهار تأثير بسيط عند النقر المزدوج (اختياري)
    const showTapFeedback = (art, type) => {
        // يمكن إضافة أيقونة تظهر وتختفي هنا مستقبلاً
        // حالياً نكتفي بتنفيذ الأمر
        console.log(`Double Tap: ${type} 10s`);
    };

    const handleDownloadClick = () => {
        if (isNativeAndroid) alert("التحميل متاح من داخل التطبيق فقط");
    };

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            <Script 
                src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" 
                strategy="afterInteractive"
                onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }}
            />
            <Script 
                src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" 
                strategy="afterInteractive"
                onLoad={() => { if (window.Hls) setLibsLoaded(true); }}
            />

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            <div className="player-wrapper">
                <div ref={artRef} className="artplayer-app"></div>
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
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: white;}
                .loading-overlay { position: absolute; z-index: 50; background: rgba(0,0,0,0.8); width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                .player-wrapper { width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .artplayer-app { width: 100%; height: 100%; }
                .download-button-native { width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }

                /* إخفاء الإشعارات تماماً عبر CSS كطبقة حماية إضافية */
                .art-notice {
                    display: none !important;
                }

                /* تثبيت حجم العلامة المائية */
                .watermark-layer {
                    padding: 4px 8px;
                    background: rgba(0, 0, 0, 0.6);
                    color: white;
                    border-radius: 4px;
                    font-weight: bold;
                    white-space: nowrap;
                    transition: top 2s ease-in-out, left 2s ease-in-out;
                    font-size: 12px !important; /* ثابت دائماً */
                    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                    opacity: 0.8;
                }
            `}</style>
        </div>
    );
}
