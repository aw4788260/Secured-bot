import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

// --- [ 1. مكون العلامة المائية المنفصل ] ---
// هذا المكون سيعمل فوق الـ Iframe وفوق الـ Artplayer لضمان الحماية في الحالتين
const WatermarkOverlay = ({ user }) => {
    const [watermarkPos, setWatermarkPos] = useState({ top: '10%', left: '10%' });

    useEffect(() => {
        if (!user) return;
        
        const moveWatermark = () => {
            const isPortrait = window.innerHeight > window.innerWidth;
            let minTop = 5, maxTop = 80;
            if (isPortrait) { minTop = 20; maxTop = 60; }
            
            const newTop = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
            const newLeft = Math.floor(Math.random() * 80) + 5;
            
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        };

        const intervalId = setInterval(moveWatermark, 5000);
        moveWatermark(); 

        return () => clearInterval(intervalId);
    }, [user]);

    return (
        <div className="watermark-content" style={{
            position: 'absolute',
            top: watermarkPos.top,
            left: watermarkPos.left,
            zIndex: 999, // طبقة عالية جداً لتظهر فوق كل شيء
            transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out',
            pointerEvents: 'none' // لكي لا تعيق النقر على الفيديو
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [videoData, setVideoData] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    const [loading, setLoading] = useState(true);      
    const [libsLoaded, setLibsLoaded] = useState(false); 
    
    // حالة الأوفلاين
    const [offlineMode, setOfflineMode] = useState(true); 

    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // دالة توحيد الجودة
    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        const closest = standards.reduce((prev, curr) => {
            return (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev);
        });
        return closest.toString();
    };

    // تحميل المكتبات
    useEffect(() => {
        if (typeof window !== 'undefined' && window.Artplayer && window.Hls) {
            setLibsLoaded(true);
        }
    }, []);

    // التعرف على المستخدم
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

    // جلب الفيديو وتشغيل المشغل المناسب
    useEffect(() => {
        if (!videoId || !libsLoaded || !user) return; 

        const params = new URLSearchParams(window.location.search);
        const currentDeviceId = params.get('deviceId');
        
        // تنظيف المشغل السابق إذا وجد
        if (playerInstance.current) {
            playerInstance.current.destroy(false);
            playerInstance.current = null;
        }

        setLoading(true);

       fetch(`/api/secure/get-video-id?lessonId=${videoId}&userId=${user.id}&deviceId=${currentDeviceId}`)
            .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
            .then(data => {
                setVideoData(data);
                setOfflineMode(data.offline_mode); 

                // =========================================================
                // [ المسار 1: الوضع أونلاين (يوتيوب Iframe) ]
                // =========================================================
                if (data.offline_mode === false) {
                    // لا نحتاج لتهيئة Artplayer هنا، سنعرض الـ iframe مباشرة في الـ JSX
                    setLoading(false);
                    return; 
                } 
                
                // =========================================================
                // [ المسار 2: الوضع أوفلاين (Artplayer Stream) ]
                // =========================================================
                if (!artRef.current || !window.Artplayer) return;

                let qualities = data.availableQualities || [];
                if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                qualities = qualities.sort((a, b) => b.quality - a.quality);
                const middleIndex = Math.floor((qualities.length - 1) / 2);

                const qualityList = qualities.map((q, index) => ({
                    default: index === middleIndex,
                    html: normalizeQuality(q.quality),
                    url: q.url,
                }));
                
                const startUrl = qualityList[middleIndex]?.url || qualityList[0].url;

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
                    
                    // طبقة الإيماءات (فقط للـ Stream)
                    layers: [
                        {
                            name: 'gestures',
                            html: `
                                <div class="gesture-wrapper">
                                    <div class="gesture-zone left" data-action="backward"><span class="icon"><span style="font-size:1.2em">«</span> 10</span></div>
                                    <div class="gesture-zone center" data-action="toggle"></div>
                                    <div class="gesture-zone right" data-action="forward"><span class="icon">10 <span style="font-size:1.2em">»</span></span></div>
                                </div>`,
                            style: {
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                                zIndex: 20, pointerEvents: 'none',
                            },
                        }
                    ],

                    customType: {
                        m3u8: function (video, url, art) {
                            if (art.hls) art.hls.destroy();
                            if (window.Hls && window.Hls.isSupported()) {
                                const hls = new window.Hls({
                                    maxBufferLength: 300, 
                                    enableWorker: true,
                                    xhrSetup: function (xhr) { xhr.withCredentials = false; }
                                });
                                hls.loadSource(url);
                                hls.attachMedia(video);
                                art.hls = hls;
                            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                video.src = url;
                            }
                        },
                    },
                });

                art.notice.show = function() {}; 

                // تفعيل منطق الإيماءات للـ Artplayer
                art.on('ready', () => {
                    const wrapper = art.layers.gestures?.querySelector('.gesture-wrapper');
                    if (wrapper) {
                        const zones = wrapper.querySelectorAll('.gesture-zone');
                        let clickCount = 0, singleTapTimer = null, accumulateTimer = null;

                        zones.forEach(zone => {
                            zone.addEventListener('click', (e) => {
                                const action = zone.getAttribute('data-action');
                                if (action === 'toggle') {
                                    clickCount++; clearTimeout(singleTapTimer);
                                    if (clickCount === 1) {
                                        singleTapTimer = setTimeout(() => {
                                            art.layers.gestures.style.display = 'none';
                                            const el = document.elementFromPoint(e.clientX, e.clientY);
                                            if(el) el.dispatchEvent(new MouseEvent('click', {view:window, bubbles:true, clientX:e.clientX, clientY:e.clientY}));
                                            art.layers.gestures.style.display = 'block';
                                            clickCount = 0;
                                        }, 300);
                                    } else { art.toggle(); clickCount = 0; }
                                    return;
                                }
                                clickCount++; clearTimeout(singleTapTimer); clearTimeout(accumulateTimer);
                                if (clickCount === 1) {
                                    singleTapTimer = setTimeout(() => {
                                        art.layers.gestures.style.display = 'none';
                                        const el = document.elementFromPoint(e.clientX, e.clientY);
                                        if(el) el.dispatchEvent(new MouseEvent('click', {view:window, bubbles:true, clientX:e.clientX, clientY:e.clientY}));
                                        art.layers.gestures.style.display = 'block';
                                        clickCount = 0;
                                    }, 250);
                                } else {
                                    const seconds = (clickCount - 1) * 10;
                                    const icon = zone.querySelector('.icon');
                                    const isForward = action === 'forward';
                                    if (isForward) icon.innerHTML = `${seconds} <span style="font-size:1.2em">»</span>`;
                                    else icon.innerHTML = `<span style="font-size:1.2em">«</span> ${seconds}`;
                                    icon.style.opacity = '1'; icon.style.transform = 'scale(1.2)';
                                    accumulateTimer = setTimeout(() => {
                                        if (isForward) art.forward = seconds; else art.backward = seconds;
                                        icon.style.opacity = '0'; icon.style.transform = 'scale(1)';
                                        clickCount = 0;
                                        setTimeout(() => { if (isForward) icon.innerHTML = `10 <span style="font-size:1.2em">»</span>`; else icon.innerHTML = `<span style="font-size:1.2em">«</span> 10`; }, 300);
                                    }, 600);
                                }
                            });
                        });
                    }
                });

                art.on('destroy', () => { if (art.hls) art.hls.destroy(); });
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
    }, [videoId, libsLoaded, user]); 

    
    const handleDownloadClick = () => {
        if (window.Android && window.Android.downloadVideoWithQualities) {
            if (videoData && videoData.availableQualities?.length > 0) {
                try {
                    const yId = videoData.youtube_video_id;
                    const vTitle = videoData.db_video_title || "Video";
                    const duration = playerInstance.current?.duration?.toString() || videoData.duration?.toString() || "0";
                    const qualitiesJson = JSON.stringify(videoData.availableQualities.map(q => ({ quality: q.quality, url: q.url })));
                    window.Android.downloadVideoWithQualities(yId, vTitle, duration, qualitiesJson, videoData.subject_name || "", videoData.chapter_name || "");
                } catch (e) { alert("حدث خطأ: " + e.message); }
            } else { alert("بيانات الفيديو غير مكتملة."); }
        } else { alert("يرجى تحديث التطبيق."); }
    };
        
    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }} />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" strategy="afterInteractive" onLoad={() => { if (window.Hls) setLibsLoaded(true); }} />

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            <div className="player-wrapper">
                
                {/* [ الشرح ]
                    هنا نتحكم فيما يتم عرضه داخل المربع الأسود (player-wrapper):
                    1. إذا كان الأوفلاين "معطل" (offlineMode === false): نعرض iframe يوتيوب مباشرة + العلامة المائية فوقه.
                    2. إذا كان الأوفلاين "مفعل": نعرض div الخاص بـ Artplayer (الذي سيحتوي الفيديو والعلامة المائية بداخله).
                */}
                
                {!offlineMode && videoData?.youtube_video_id ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <iframe 
                            src={`https://www.youtube.com/embed/${videoData.youtube_video_id}?controls=0&playsinline=1&rel=0&modestbranding=1`}
                            title="YouTube Video"
                            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                        ></iframe>
                        
                        {/* العلامة المائية المنفصلة (تظهر فوق الـ Iframe) */}
                        <WatermarkOverlay user={user} />
                    </div>
                ) : (
                    <>
                       {/* Artplayer يظهر هنا في حالة الأوفلاين (ويحتوي العلامة المائية بداخله عبر layers) */}
                       <div ref={artRef} className="artplayer-app"></div>
                       
                       {/* (احتياطي) إذا كنت تريد العلامة المائية "دائماً" من الخارج حتى مع Artplayer، يمكنك وضعها هنا وإزالتها من إعدادات layers */}
                       {/* <WatermarkOverlay user={user} /> */}
                    </>
                )}
                
            </div>

            {isNativeAndroid && offlineMode && (
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
                
                .loading-overlay { 
                    position: absolute; z-index: 9999; background: #000; 
                    width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; 
                    color: white; font-size: 1.2rem; 
                }
                
                .player-wrapper { 
                    width: 100%; max-width: 900px; aspect-ratio: 16/9; 
                    background: #000; position: relative; border-radius: 8px; overflow: hidden; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }
                .artplayer-app { width: 100%; height: 100%; }
                
                .download-button-native { width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }

                .watermark-content {
                    padding: 2px 10px; background: rgba(0, 0, 0, 0.5); color: rgba(255, 255, 255, 0.9); 
                    border-radius: 4px; white-space: nowrap; font-size: 11px !important; font-weight: bold; 
                    text-shadow: 1px 1px 2px black; pointer-events: none;
                }

                .gesture-wrapper { width: 100%; height: 100%; display: flex; }
                .gesture-zone.left, .gesture-zone.right { width: 30%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone.center { width: 40%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone .icon { 
                    font-size: 18px; font-weight: bold; font-family: sans-serif; color: rgba(255, 255, 255, 0.9);
                    opacity: 0; transition: opacity 0.2s, transform 0.2s; background: transparent; 
                    padding: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); pointer-events: none; 
                }
                .gesture-zone.center .icon { font-size: 30px; }
            `}</style>
        </div>
    );
}
