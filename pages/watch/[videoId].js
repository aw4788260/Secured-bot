// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// استدعاء Plyr (للوضع الأونلاين)
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// =========================================================================
// 1. مكون العلامة المائية (لـ Plyr فقط) - طبقة منفصلة شفافة للمس
// =========================================================================
const WatermarkOverlay = ({ user }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });
    
    useEffect(() => {
        if (!user) return;
        const move = () => {
            const t = Math.floor(Math.random() * 80) + 5;
            const l = Math.floor(Math.random() * 80) + 5;
            setPos({ top: `${t}%`, left: `${l}%` });
        };
        const interval = setInterval(move, 5000);
        move(); // تحريك فوري
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div className="watermark-overlay" style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            zIndex: 50, // فوق الفيديو
            pointerEvents: 'none', // ✅ السر: اللمس يعبر من خلالها لأزرار التحكم
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.6)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px',
            borderRadius: '4px',
            fontWeight: 'bold',
            transition: 'top 2s ease, left 2s ease',
            whiteSpace: 'nowrap',
            userSelect: 'none'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

// =========================================================================
// 2. الصفحة الرئيسية (التحكم الكامل)
// =========================================================================
export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    // States
    const [videoData, setVideoData] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    const [loading, setLoading] = useState(true);      
    const [libsLoaded, setLibsLoaded] = useState(false); 
    const [viewMode, setViewMode] = useState(null); // 'native' or 'youtube'

    // Refs
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // =========================================================================
    // دالة توحيد الجودة (من كودك الأصلي)
    // =========================================================================
    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        const closest = standards.reduce((prev, curr) => {
            return (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev);
        });
        return closest.toString();
    };

    // تحميل مكتبات Artplayer
    useEffect(() => {
        if (typeof window !== 'undefined' && window.Artplayer && window.Hls) {
            setLibsLoaded(true);
        }
    }, []);

    // 1. التعرف على المستخدم
    useEffect(() => {
        const setupUser = (u) => { if (u && u.id) setUser(u); else setError("خطأ: لا يمكن التعرف على المستخدم."); };
        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        if (urlUserId) {
            setupUser({ id: urlUserId, first_name: params.get("firstName") || "User" });
            if (typeof window.Android !== 'undefined') setIsNativeAndroid(true);
        } else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u); else setError("يرجى الفتح من تليجرام.");
        }
    }, []);

    // 2. جلب البيانات وتحديد الوضع
    useEffect(() => {
        if (!videoId || !user) return; 

        setLoading(true);
        const params = new URLSearchParams(window.location.search);
        const currentDeviceId = params.get('deviceId');
        
        if (playerInstance.current) {
            playerInstance.current.destroy(false);
            playerInstance.current = null;
        }

       fetch(`/api/secure/get-video-id?lessonId=${videoId}&userId=${user.id}&deviceId=${currentDeviceId}`)
            .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
            .then(data => {
                setVideoData(data);
                if (data.offline_mode === true) {
                    setViewMode('native');
                } else {
                    setViewMode('youtube');
                }
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });

        return () => {
            if (playerInstance.current) playerInstance.current.destroy(false);
        };
    }, [videoId, user]);

    // =========================================================================
    // 3. منطق Artplayer (نسخ ولصق حرفي من كودك الأصلي - File 1)
    // =========================================================================
    useEffect(() => {
        if (viewMode !== 'native' || !videoData || !libsLoaded || !artRef.current || !window.Artplayer || !user) return;

        let qualities = videoData.availableQualities || [];
        if (qualities.length > 0) qualities = qualities.sort((a, b) => b.quality - a.quality);
        
        const middleIndex = Math.floor((qualities.length - 1) / 2);
        const qualityList = qualities.map((q, index) => ({
            default: index === middleIndex,
            html: normalizeQuality(q.quality),
            url: q.url,
        }));
        
        const startUrl = qualityList[middleIndex]?.url || qualityList[0]?.url || "";
        const title = videoData.db_video_title || "مشاهدة الدرس";

        // إعداد المشغل (نفس إعدادات كودك الأصلي تماماً)
        const art = new window.Artplayer({
            container: artRef.current,
            url: startUrl, 
            quality: qualityList,
            title: title,
            volume: 0.7,
            isLive: false, muted: false, autoplay: false,
            autoSize: true, autoMini: true, screenshot: false, setting: true,
            loop: false, flip: false, playbackRate: true, aspectRatio: false,
            fullscreen: true, fullscreenWeb: true, miniProgressBar: true,
            mutex: true, backdrop: true, playsInline: true,
            theme: '#38bdf8', lang: 'ar',
            
           layers: [
                {
                    name: 'watermark',
                    html: `<div class="watermark-content">${user.first_name} (${user.id})</div>`,
                    style: {
                        position: 'absolute', top: '10%', left: '10%', pointerEvents: 'none', zIndex: 25,
                        transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out'
                    },
                },
                {
                    name: 'gestures',
                    html: `
    <div class="gesture-wrapper">
        <div class="gesture-zone left" data-action="backward">
            <span class="icon"><span style="font-size:1.2em">«</span> 10</span>
        </div>
        
        <div class="gesture-zone center" data-action="toggle"></div>

        <div class="gesture-zone right" data-action="forward">
            <span class="icon">10 <span style="font-size:1.2em">»</span></span>
        </div>
    </div>
`,
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
            // 1. العلامة المائية الداخلية (الخاصة بـ Artplayer فقط)
            const watermarkLayer = art.layers.watermark;
            const moveWatermark = () => {
                if (!watermarkLayer) return;
                const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
                const isPortrait = window.innerHeight > window.innerWidth;
                let minTop = 5, maxTop = 80; 
                if (isTelegram && isPortrait) { minTop = 38; maxTop = 58; }
                const newTop = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
                const newLeft = Math.floor(Math.random() * 80) + 5;
                watermarkLayer.style.top = `${newTop}%`;
                watermarkLayer.style.left = `${newLeft}%`;
            };
            moveWatermark();
            const watermarkInterval = setInterval(moveWatermark, 5500);

            // 2. منطق اللمس المتطور (التراكمي) - كما هو
            const wrapper = art.layers.gestures.querySelector('.gesture-wrapper');
            const zones = wrapper.querySelectorAll('.gesture-zone');
            
            let clickCount = 0;
            let singleTapTimer = null;
            let accumulateTimer = null;

            zones.forEach(zone => {
                zone.addEventListener('click', (e) => {
                    const action = zone.getAttribute('data-action');
                    
                    // --- المنطقة الوسطى ---
                    if (action === 'toggle') {
                        clickCount++;
                        clearTimeout(singleTapTimer);
                        if (clickCount === 1) {
                            singleTapTimer = setTimeout(() => {
                                simulateSingleTap(e);
                                clickCount = 0;
                            }, 300);
                        } else {
                            art.toggle();
                            clickCount = 0;
                        }
                        return;
                    }

                    // --- الجوانب ---
                    clickCount++;
                    clearTimeout(singleTapTimer);
                    clearTimeout(accumulateTimer); 

                    if (clickCount === 1) {
                        singleTapTimer = setTimeout(() => {
                            simulateSingleTap(e);
                            clickCount = 0;
                        }, 250);
                    } else {
                        const seconds = (clickCount - 1) * 10;
                        const icon = zone.querySelector('.icon');
                        const isForward = action === 'forward';
                        
                        if (isForward) {
                            icon.innerHTML = `${seconds} <span style="font-size:1.2em">»</span>`;
                        } else {
                            icon.innerHTML = `<span style="font-size:1.2em">«</span> ${seconds}`;
                        }
                        showFeedback(icon, true);

                        accumulateTimer = setTimeout(() => {
                            if (isForward) art.forward = seconds;
                            else art.backward = seconds;
                            hideFeedback(icon);
                            clickCount = 0;
                            setTimeout(() => {
                                if (isForward) {
                                    icon.innerHTML = `10 <span style="font-size:1.2em">»</span>`;
                                } else {
                                    icon.innerHTML = `<span style="font-size:1.2em">«</span> 10`;
                                }
                            }, 300);
                        }, 600);
                    }
                });
            });

            const simulateSingleTap = (e) => {
                const gestureLayer = art.layers.gestures;
                gestureLayer.style.display = 'none';
                const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
                if (elementBelow) {
                    const clickEvent = new MouseEvent('click', {
                        view: window, bubbles: true, cancelable: true,
                        clientX: e.clientX, clientY: e.clientY
                    });
                    elementBelow.dispatchEvent(clickEvent);
                }
                gestureLayer.style.display = 'block';
            };

            const showFeedback = (el, stayVisible = false) => {
                if (!el) return;
                el.style.opacity = '1';
                el.style.transform = 'scale(1.2)';
            };

            const hideFeedback = (el) => {
                if (!el) return;
                el.style.opacity = '0';
                el.style.transform = 'scale(1)';
            };

            art.on('destroy', () => clearInterval(watermarkInterval));
        });

        art.on('destroy', () => {
            if (art.hls) art.hls.destroy();
        });

        playerInstance.current = art;

    }, [viewMode, videoData, libsLoaded, user]);

    // دالة التحميل (تعمل فقط في الوضع Native)
    const handleDownloadClick = () => {
        if (!window.Android) { alert("تحديث التطبيق مطلوب."); return; }
        if (viewMode === 'native' && window.Android.downloadVideoWithQualities) {
            if (videoData && videoData.availableQualities) {
                try {
                    const yId = videoData.youtube_video_id;
                    const vTitle = videoData.db_video_title || "Video";
                    const subjectName = videoData.subject_name || "Unknown";
                    const chapterName = videoData.chapter_name || "Unknown";
                    let duration = "0";
                    if (playerInstance.current && playerInstance.current.duration) {
                        duration = playerInstance.current.duration.toString(); 
                    } else if (videoData.duration) duration = videoData.duration.toString();

                    const qualitiesJson = JSON.stringify(videoData.availableQualities.map(q => ({
                        quality: q.quality, url: q.url
                    })));
                    window.Android.downloadVideoWithQualities(yId, vTitle, duration, qualitiesJson, subjectName, chapterName);
                } catch (e) { alert("خطأ: " + e.message); }
            } else { alert("بيانات غير مكتملة."); }
        } else {
             alert("التحميل غير متاح.");
        }
    };

    // =========================================================================
    // 4. إعدادات Plyr (للوضع الثاني)
    // ✅ تم التأكد من تفعيل الـ controls
    // =========================================================================
    const plyrSource = videoData?.youtube_video_id ? {
        type: 'video',
        sources: [{ src: videoData.youtube_video_id, provider: 'youtube' }],
    } : null;

    const plyrOptions = {
        // تحديد أدوات التحكم بدقة
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
        settings: ['quality', 'speed'],
        // إعدادات اليوتيوب للسماح بالتحكم
        youtube: { 
            noCookie: false, 
            rel: 0, 
            showinfo: 0, 
            iv_load_policy: 3, 
            modestbranding: 1
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
                {/* الوضع الأول: Native Artplayer */}
                {viewMode === 'native' && (
                     <div ref={artRef} className="artplayer-app"></div>
                )}

                {/* الوضع الثاني: Plyr + العلامة المائية المستقلة */}
                {viewMode === 'youtube' && !loading && (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <Plyr 
                            key={videoData?.youtube_video_id} 
                            source={plyrSource} 
                            options={plyrOptions} 
                        />
                        {/* العلامة المائية كطبقة منفصلة (Sibling).
                            مفصولة تماماً عن المشغل لتجنب المشاكل.
                            لها pointer-events: none لتعبر النقرات من خلالها.
                        */}
                        <WatermarkOverlay user={user} />
                    </div>
                )}
            </div>

            {/* زر التحميل فقط في وضع Native */}
            {isNativeAndroid && viewMode === 'native' && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info">
                <p>برمجة وتطوير: A7MeD WaLiD</p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #000; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; position: relative; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: white; background: #000; }
                .loading-overlay { position: absolute; z-index: 50; background: #000; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                
                .player-wrapper { 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: ${viewMode === 'youtube' ? '16/7' : '16/9'};
                    background: #000; 
                    position: relative; 
                    border-radius: 8px; 
                    overflow: hidden; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }
                
                .artplayer-app { width: 100%; height: 100%; }
                
                .download-button-native { width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }

                /* إخفاء عناصر Artplayer المزعجة */
                .art-notice, .art-control-lock, .art-layer-lock, div[data-art-control="lock"] { display: none !important; }

                /* CSS خاص بـ Artplayer */
                .watermark-content {
                    padding: 2px 10px; 
                    background: rgba(0, 0, 0, 0.5); 
                    color: rgba(255, 255, 255, 0.9); 
                    border-radius: 4px;
                    white-space: nowrap; 
                    font-size: 11px !important; 
                    font-weight: bold;
                    text-shadow: 1px 1px 2px black;
                    pointer-events: none;
                }
                .gesture-wrapper { width: 100%; height: 100%; display: flex; }
                .gesture-zone.left, .gesture-zone.right { width: 30%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone.center { width: 40%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone .icon { font-size: 18px; font-weight: bold; font-family: sans-serif; color: rgba(255, 255, 255, 0.9); opacity: 0; transition: opacity 0.2s, transform 0.2s; background: transparent; padding: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); pointer-events: none; }
                .gesture-zone.center .icon { font-size: 30px; }
            `}</style>
        </div>
    );
}
