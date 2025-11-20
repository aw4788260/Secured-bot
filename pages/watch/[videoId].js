import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [videoData, setVideoData] = useState(null);
    const RAILWAY_PROXY_URL = "https://web-production-3a04a.up.railway.app";
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
                setVideoData(data);
                let qualities = data.availableQualities || [];
                if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                
                // 1. ترتيب الجودات (الأعلى أولاً)
                qualities = qualities.sort((a, b) => b.quality - a.quality);

                // 2. اختيار الجودة المتوسطة لتكون الافتراضية
                const middleIndex = Math.floor((qualities.length - 1) / 2);

                const qualityList = qualities.map((q, index) => ({
                    default: index === middleIndex,
                    html: `${q.quality}p`,
                    url: q.url,
                }));
                
                const startUrl = qualityList[middleIndex]?.url || qualityList[0].url;

                if (!artRef.current || !window.Artplayer) return;

                // --- إعداد Artplayer ---
                const art = new window.Artplayer({
                    container: artRef.current,
                    url: startUrl, 
                    quality: qualityList,
                    title: data.videoTitle || "مشاهدة الدرس",
                    volume: 0.7,
                    isLive: false,
                    muted: false,
                    autoplay: false,
                    autoSize: true,
                    autoMini: true,
                    screenshot: false,
                    setting: true,
                    loop: false,
                    flip: false,
                    playbackRate: true,
                    aspectRatio: false,
                    fullscreen: true,
                    fullscreenWeb: true,
                    miniProgressBar: true,
                    mutex: true,
                    backdrop: true,
                    playsInline: true,
                    theme: '#38bdf8',
                    lang: 'ar',
                    
                    layers: [
                        {
                            // ✅ تم تعديل الكلاس هنا ليأخذ التنسيقات الجديدة
                            html: `<div class="watermark-layer">${user.first_name} (${user.id})</div>`,
                            style: {
                                position: 'absolute', top: '10%', left: '10%', pointerEvents: 'none', zIndex: 20,
                            },
                        },
                        {
                            // طبقة اللمس
                            html: `
                                <div class="gesture-layer">
                                    <div class="gesture-box left">
                                        <span class="icon">10&lt;&lt;</span>
                                    </div>
                                    <div class="gesture-box right">
                                        <span class="icon">&gt;&gt;10</span>
                                    </div>
                                </div>
                            `,
                            name: 'gestures',
                            style: {
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '85%', 
                                zIndex: 10,
                            },
                        }
                    ],
                    
                    customType: {
                        m3u8: function (video, url, art) {
                            if (art.hls) art.hls.destroy();
                            if (window.Hls && window.Hls.isSupported()) {
                                const hls = new window.Hls({
                                    maxBufferLength: 30, enableWorker: true,
                                    xhrSetup: function (xhr) { xhr.withCredentials = false; }
                                });
                                hls.loadSource(url);
                                hls.attachMedia(video);
                                hls.on(window.Hls.Events.ERROR, (event, data) => {
                                    if (data.fatal) {
                                        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                                            hls.destroy(); video.src = url;
                                        } else { hls.destroy(); }
                                    }
                                });
                                art.hls = hls;
                            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                video.src = url;
                            }
                        },
                    },
                });

                art.notice.show = function() {}; 

                art.on('ready', () => {
                    // --- 1. منطق تحريك العلامة المائية (Random Movement) ---
                    const moveWatermark = () => {
                        const layer = art.template.$player.querySelector('.watermark-layer');
                        if (layer) {
                            // توليد إحداثيات عشوائية بين 5% و 85% لضمان بقائها داخل الشاشة
                            const newTop = Math.random() * 80 + 5;
                            const newLeft = Math.random() * 80 + 5;
                            layer.style.top = `${newTop}%`;
                            layer.style.left = `${newLeft}%`;
                        }
                    };

                    // تحريكها فوراً
                    moveWatermark();
                    // تحريكها كل 4 ثواني
                    const watermarkInterval = setInterval(moveWatermark, 4000);

                    // تنظيف المؤقت عند تدمير المشغل
                    art.on('destroy', () => clearInterval(watermarkInterval));


                    // --- 2. منطق اللمسات (Gestures Logic) ---
                    const gestureLayer = art.layers.gestures;
                    const feedbackLeft = gestureLayer.querySelector('.gesture-box.left');
                    const feedbackRight = gestureLayer.querySelector('.gesture-box.right');
                    
                    let clickTimer = null;
                    let lastClickTime = 0;

                    gestureLayer.addEventListener('click', (e) => {
                        const currentTime = new Date().getTime();
                        const timeDiff = currentTime - lastClickTime;
                        
                        // --- سيناريو النقر المزدوج (Double Tap) ---
                        if (timeDiff < 300) {
                            clearTimeout(clickTimer); 
                            
                            const rect = gestureLayer.getBoundingClientRect();
                            const x = e.clientX - rect.left; 
                            const width = rect.width;

                            if (x < width * 0.35) {
                                art.backward = 10;
                                showFeedback(feedbackLeft);
                            } else if (x > width * 0.65) {
                                art.forward = 10;
                                showFeedback(feedbackRight);
                            } 
                        } 
                        // --- سيناريو النقر المفرد (Single Tap) ---
                        else {
                            clickTimer = setTimeout(() => {
                                gestureLayer.style.display = 'none';
                                const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
                                if (elementBelow) {
                                    const event = new MouseEvent('click', {
                                        view: window, bubbles: true, cancelable: true,
                                        clientX: e.clientX, clientY: e.clientY
                                    });
                                    elementBelow.dispatchEvent(event);
                                }
                                gestureLayer.style.display = 'block';
                            }, 300);
                        }
                        lastClickTime = currentTime;
                    });

                    const showFeedback = (el) => {
                        if (!el) return;
                        el.style.opacity = '1';
                        el.style.transform = 'scale(1.2)';
                        setTimeout(() => {
                            el.style.opacity = '0';
                            el.style.transform = 'scale(1)';
                        }, 500);
                    };
                });

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

        return () => {
            if (playerInstance.current) playerInstance.current.destroy(false);
        };
    }, [videoId, libsLoaded]); 

    const handleDownloadClick = () => {
        if (window.Android && window.Android.downloadVideo) {
            if (videoData && (videoData.youtube_video_id || videoData.youtubeId)) {
                try {
                    const yId = videoData.youtube_video_id || videoData.youtubeId;
                    const vTitle = videoData.videoTitle || videoData.title || "Video";
                    
                    let duration = "0";
                    if (playerInstance.current && playerInstance.current.duration) {
                        duration = playerInstance.current.duration.toString(); 
                    }

                    window.Android.downloadVideo(yId, vTitle, RAILWAY_PROXY_URL, duration);
                    
                } catch (e) {
                    alert("حدث خطأ أثناء الاتصال بالتطبيق: " + e.message);
                }
            } else {
                alert("بيانات الفيديو لم تكتمل بعد، يرجى الانتظار.");
            }
        } else {
            alert("التحميل متاح من داخل التطبيق فقط.");
        }
    };  

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }} />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" strategy="afterInteractive" onLoad={() => { if (window.Hls) setLibsLoaded(true); }} />

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

                .art-notice { display: none !important; }
                .art-control-lock, .art-layer-lock, div[data-art-control="lock"] { display: none !important; }

                /* ✅✅ تم تحديث تنسيق العلامة المائية لتكون أصغر وأكثر شفافية ✅✅ */
                .watermark-layer {
                    padding: 3px 6px; 
                    background: rgba(0, 0, 0, 0.4); 
                    color: rgba(255, 255, 255, 0.6); 
                    border-radius: 3px;
                    white-space: nowrap; 
                    transition: top 3s ease-in-out, left 3s ease-in-out;
                    font-size: 9px !important; 
                    text-shadow: none; 
                    opacity: 0.6;
                    pointer-events: none;
                }

                .gesture-box {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    background: rgba(0,0,0,0.6); padding: 12px 18px; border-radius: 50px;
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; transition: opacity 0.2s, transform 0.2s;
                    pointer-events: none; color: white;
                }
                .gesture-box.left { left: 15%; }
                .gesture-box.right { right: 15%; }
                .gesture-box .icon { 
                    font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: -1px;
                }
            `}</style>
        </div>
    );
}
