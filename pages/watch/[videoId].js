// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// 1. استيراد Plyr (للوضع الأونلاين - OfflineOff)
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// =========================================================================
// 2. مكون العلامة المائية (الخاص بـ Plyr - من الكود النصي)
// =========================================================================
const PlyrWatermark = ({ user }) => {
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
            clearInterval(watermarkIntervalRef.current); 
        };
    }, [user]);

    return (
        <div className="watermark" style={{ 
            position: 'absolute', 
            top: watermarkPos.top, 
            left: watermarkPos.left,
            zIndex: 15, 
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
    );
};

// =========================================================================
// 3. مكون مشغل Artplayer (الوضع Native / OfflineOn - من الملف المرفق)
// =========================================================================
const NativeArtPlayer = ({ videoData, user, isNativeAndroid, libsLoaded }) => {
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        return standards.reduce((prev, curr) => (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev)).toString();
    };

    useEffect(() => {
        // ننتظر تحميل المكتبات والبيانات
        if (!libsLoaded || !user || !videoData || !artRef.current || !window.Artplayer) return;

        if (playerInstance.current) {
            playerInstance.current.destroy(false);
            playerInstance.current = null;
        }

        let qualities = videoData.availableQualities || [];
        if (qualities.length > 0) qualities = qualities.sort((a, b) => b.quality - a.quality);
        
        const middleIndex = Math.floor((qualities.length - 1) / 2);
        const qualityList = qualities.map((q, index) => ({
            default: index === middleIndex,
            html: normalizeQuality(q.quality),
            url: q.url,
        }));
        
        const startUrl = qualityList[middleIndex]?.url || qualityList[0]?.url || "";
        const title = videoData.db_video_title || videoData.videoTitle || "مشاهدة الدرس";

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
            
            // ✅ طبقات الملف المرفق (علامة مائية داخلية + إيماءات)
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
                            maxBufferLength: 300, enableWorker: true,
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

        art.on('ready', () => {
            // منطق تحريك العلامة المائية الداخلية (كما في الملف)
            const watermarkLayer = art.layers.watermark;
            const moveWatermark = () => {
                if (!watermarkLayer) return;
                const newTop = Math.floor(Math.random() * 80) + 5;
                const newLeft = Math.floor(Math.random() * 80) + 5;
                watermarkLayer.style.top = `${newTop}%`;
                watermarkLayer.style.left = `${newLeft}%`;
            };
            moveWatermark();
            const watermarkInterval = setInterval(moveWatermark, 5500);

            // منطق اللمس (Gestures) - كما في الملف
            const wrapper = art.layers.gestures.querySelector('.gesture-wrapper');
            const zones = wrapper.querySelectorAll('.gesture-zone');
            let clickCount = 0, singleTapTimer = null, accumulateTimer = null;

            zones.forEach(zone => {
                zone.addEventListener('click', (e) => {
                    const action = zone.getAttribute('data-action');
                    if (action === 'toggle') {
                        clickCount++;
                        clearTimeout(singleTapTimer);
                        if (clickCount === 1) {
                            singleTapTimer = setTimeout(() => { simulateSingleTap(e); clickCount = 0; }, 300);
                        } else { art.toggle(); clickCount = 0; }
                        return;
                    }
                    clickCount++;
                    clearTimeout(singleTapTimer);
                    clearTimeout(accumulateTimer); 
                    if (clickCount === 1) {
                        singleTapTimer = setTimeout(() => { simulateSingleTap(e); clickCount = 0; }, 250);
                    } else {
                        const seconds = (clickCount - 1) * 10;
                        const icon = zone.querySelector('.icon');
                        const isForward = action === 'forward';
                        if (isForward) icon.innerHTML = `${seconds} <span style="font-size:1.2em">»</span>`;
                        else icon.innerHTML = `<span style="font-size:1.2em">«</span> ${seconds}`;
                        showFeedback(icon, true);
                        accumulateTimer = setTimeout(() => {
                            if (isForward) art.forward = seconds; else art.backward = seconds;
                            hideFeedback(icon); clickCount = 0;
                            setTimeout(() => {
                                if (isForward) icon.innerHTML = `10 <span style="font-size:1.2em">»</span>`;
                                else icon.innerHTML = `<span style="font-size:1.2em">«</span> 10`;
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
                    const clickEvent = new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY });
                    elementBelow.dispatchEvent(clickEvent);
                }
                gestureLayer.style.display = 'block';
            };
            const showFeedback = (el) => { if (el) { el.style.opacity = '1'; el.style.transform = 'scale(1.2)'; } };
            const hideFeedback = (el) => { if (el) { el.style.opacity = '0'; el.style.transform = 'scale(1)'; } };

            art.on('destroy', () => clearInterval(watermarkInterval));
        });

        art.on('destroy', () => { if (art.hls) art.hls.destroy(); });
        playerInstance.current = art;

        return () => { if (playerInstance.current) playerInstance.current.destroy(false); };
    }, [libsLoaded, user, videoData]);

    // ✅ دالة التحميل (تعمل هنا لأنها جزء من NativeArtPlayer)
    const handleDownloadClick = () => {
        if (!window.Android) { alert("يرجى تحديث التطبيق."); return; }
        
        if (window.Android.downloadVideoWithQualities && videoData.availableQualities && videoData.availableQualities.length > 0) {
            try {
                const yId = videoData.youtube_video_id || videoData.youtubeId;
                const vTitle = videoData.db_video_title || videoData.videoTitle || "Video";
                const subjectName = videoData.subject_name || "Unknown Subject";
                const chapterName = videoData.chapter_name || "Unknown Chapter";
                
                let duration = "0";
                if (playerInstance.current && playerInstance.current.duration) {
                    duration = playerInstance.current.duration.toString(); 
                } else if (videoData.duration) {
                    duration = videoData.duration.toString();
                }

                const qualitiesPayload = videoData.availableQualities.map(q => ({ quality: q.quality, url: q.url }));
                const qualitiesJson = JSON.stringify(qualitiesPayload);
                
                // استدعاء دالة الأندرويد (6 متغيرات)
                window.Android.downloadVideoWithQualities(yId, vTitle, duration, qualitiesJson, subjectName, chapterName);
            } catch (e) { alert("حدث خطأ: " + e.message); }
        } else { alert("بيانات الفيديو غير مكتملة."); }
    };

    return (
        <>
            <div className="artplayer-app" ref={artRef}></div>
            
            {/* ✅ زر التحميل يظهر فقط هنا (في وضع Native/OfflineOn) */}
            {isNativeAndroid && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}
        </>
    );
};


// =========================================================================
// 4. مكون مشغل Plyr (الوضع Online / OfflineOff - من الكود النصي)
// =========================================================================
const YoutubePlyrPlayer = ({ videoData, user }) => {
    const plyrSource = {
        type: 'video',
        sources: [{ src: videoData.youtube_video_id, provider: 'youtube' }],
    };

    const plyrOptions = {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['quality', 'speed'],
        youtube: { rel: 0, showinfo: 0, modestbranding: 1, controls: 0 },
        fullscreen: {
            enabled: true,
            fallback: true,
            iosNative: true,
            container: '.player-wrapper' // ✅ ربط الحاوية للإصلاح
        }
    };

    return (
        // الحاوية النسبية مهمة للعلامة المائية
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Plyr key={videoData.youtube_video_id} source={plyrSource} options={plyrOptions} />
            {/* ✅ العلامة المائية الخارجية الخاصة بـ Plyr */}
            <PlyrWatermark user={user} />
        </div>
    );
};


// =========================================================================
// 5. الصفحة الرئيسية (Main Controller)
// =========================================================================
export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [videoData, setVideoData] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    const [loading, setLoading] = useState(true);      
    const [libsLoaded, setLibsLoaded] = useState(false); 
    const [viewMode, setViewMode] = useState(null); // 'native' or 'youtube'

    const playerWrapperRef = useRef(null);

    // 1. التحقق من المستخدم
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

    // 2. جلب البيانات وتحديد الوضع (OfflineOn/Off)
    useEffect(() => {
        if (!videoId || !user) return; 
        setLoading(true);
        const params = new URLSearchParams(window.location.search);
        const currentDeviceId = params.get('deviceId');

       fetch(`/api/secure/get-video-id?lessonId=${videoId}&userId=${user.id}&deviceId=${currentDeviceId}`)
            .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
            .then(data => {
                setVideoData(data);
                // تحديد الوضع بناءً على رد الـ API
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
    }, [videoId, user]);

    if (error) return <div className="message-container"><h1>{error}</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            {/* تحميل مكتبات Artplayer */}
            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }} />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" strategy="afterInteractive" onLoad={() => { if (window.Hls) setLibsLoaded(true); }} />

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            {!loading && (
                // الحاوية الرئيسية
                <div className="player-wrapper" ref={playerWrapperRef}>
                    
                    {/* 1. تشغيل Artplayer (Native) */}
                    {viewMode === 'native' && (
                        <NativeArtPlayer 
                            videoData={videoData} 
                            user={user} 
                            isNativeAndroid={isNativeAndroid}
                            libsLoaded={libsLoaded} 
                        />
                    )}

                    {/* 2. تشغيل Plyr (Youtube) */}
                    {viewMode === 'youtube' && (
                        <YoutubePlyrPlayer videoData={videoData} user={user} />
                    )}
                </div>
            )}

            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
                <p>برمجة وتطوير: A7MeD WaLiD</p>
                <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; overscroll-behavior: contain; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 10px; box-sizing: border-box; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; padding: 20px; text-align: center; }
                .loading-overlay { position: absolute; z-index: 50; background: #111; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                
                /* تنسيقات الحاوية */
                .player-wrapper { 
                    position: relative; 
                    width: 100%; 
                    max-width: 900px; 
                    /* تغيير النسبة حسب الوضع */
                    aspect-ratio: ${viewMode === 'youtube' ? '16/7' : '16/9'};
                    background: #111; 
                    border-radius: 8px; 
                    overflow: hidden; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }

                /* تكبير الحاوية عند ملء الشاشة (مهم جداً لـ Plyr) */
                .player-wrapper:fullscreen, .player-wrapper:-webkit-full-screen, .player-wrapper:-moz-full-screen {
                    width: 100%; height: 100%; max-width: none; aspect-ratio: auto; background: #000;
                    display: flex; align-items: center; justify-content: center;
                }
                
                .player-wrapper .plyr { width: 100%; height: 100%; }
                .artplayer-app { width: 100%; height: 100%; }
                
                /* زر التحميل */
                .download-button-native { 
                    width: 100%; max-width: 900px; padding: 12px 20px; 
                    background-color: #38bdf8; color: #111827; 
                    border: none; border-radius: 8px; font-weight: bold; 
                    cursor: pointer; font-size: 16px; margin: 15px 0 0 0; 
                    display: block; transition: background-color 0.3s ease; 
                }
                .download-button-native:hover { background-color: #7dd3fc; }
                
                .developer-info { width: 100%; text-align: center; font-size: 0.85rem; color: #777; margin-top: 20px; }
                .developer-info a { color: #38bdf8; text-decoration: none; }

                /* إخفاء عناصر Artplayer */
                .art-notice, .art-control-lock, .art-layer-lock, div[data-art-control="lock"] { display: none !important; }
                
                /* تنسيقات Artplayer الداخلية */
                .watermark-content { padding: 2px 10px; background: rgba(0, 0, 0, 0.5); color: rgba(255, 255, 255, 0.9); border-radius: 4px; white-space: nowrap; font-size: 11px !important; font-weight: bold; text-shadow: 1px 1px 2px black; pointer-events: none; }
                .gesture-wrapper { width: 100%; height: 100%; display: flex; }
                .gesture-zone.left, .gesture-zone.right { width: 30%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone.center { width: 40%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone .icon { font-size: 18px; font-weight: bold; font-family: sans-serif; color: rgba(255, 255, 255, 0.9); opacity: 0; transition: opacity 0.2s, transform 0.2s; background: transparent; padding: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); pointer-events: none; }
                .gesture-zone.center .icon { font-size: 30px; }
            `}</style>
        </div>
    );
}
