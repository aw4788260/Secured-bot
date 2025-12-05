import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useMemo } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// 1. استيراد Plyr
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// =========================================================================
// 2. مكون العلامة المائية (Plyr)
// =========================================================================
const PlyrWatermark = ({ user, isFullscreen }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });

    useEffect(() => {
        if (!user) return;
        const move = () => {
            const isTelegram = !!(typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp);
            const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
            
            let minTop = 5, maxTop = 80; 
            if (isTelegram && isPortrait && !isFullscreen) { minTop = 38; maxTop = 58; }
            
            const t = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
            const l = Math.floor(Math.random() * 80) + 5;
            setPos({ top: `${t}%`, left: `${l}%` });
        };
        const interval = setInterval(move, 5000);
        move();
        return () => clearInterval(interval);
    }, [user, isFullscreen]);

    return (
        <div className="plyr-watermark" style={{
            position: isFullscreen ? 'fixed' : 'absolute',
            zIndex: 2147483647,
            top: pos.top, left: pos.left,
            padding: '4px 8px', 
            background: 'rgba(0,0,0,0.5)', 
            color: 'rgba(255,255,255,0.7)', 
            fontSize: '12px', 
            borderRadius: '4px',
            fontWeight: 'bold', 
            transition: 'top 2s ease, left 2s ease',
            userSelect: 'none', whiteSpace: 'nowrap', 
            textShadow: '1px 1px 2px black',
            pointerEvents: 'none' 
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

// =========================================================================
// 3. مكون مشغل Artplayer (Native)
// =========================================================================
const NativeArtPlayer = ({ videoData, user, libsLoaded, onPlayerReady }) => {
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        return standards.reduce((prev, curr) => (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev)).toString();
    };

    useEffect(() => {
        if (!libsLoaded || !user || !videoData || !artRef.current || !window.Artplayer) return;
        if (playerInstance.current) { playerInstance.current.destroy(false); playerInstance.current = null; }

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

        const art = new window.Artplayer({
            container: artRef.current,
            url: startUrl,
            type: 'm3u8', quality: qualityList, title: title, volume: 0.7,
            isLive: false, muted: false, autoplay: false,
            autoSize: false, autoMini: true, screenshot: false, setting: true,
            loop: false, flip: false, playbackRate: true, aspectRatio: true,
            fullscreen: true, fullscreenWeb: true, miniProgressBar: true,
            mutex: true, backdrop: true, playsInline: true,
            theme: '#38bdf8', lang: 'ar',
            layers: [
                {
                    name: 'watermark',
                    html: `<div class="watermark-content">${user.first_name} (${user.id})</div>`,
                    style: { position: 'absolute', top: '10%', left: '10%', pointerEvents: 'none', zIndex: 25, transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out' },
                },
                {
                    name: 'gestures',
                    html: `<div class="gesture-wrapper"><div class="gesture-zone left" data-action="backward"><span class="icon">« 10</span></div><div class="gesture-zone center" data-action="toggle"></div><div class="gesture-zone right" data-action="forward"><span class="icon">10 »</span></div></div>`,
                    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, pointerEvents: 'none' },
                }
            ],
            customType: {
                m3u8: function (video, url, art) {
                    if (art.hls) art.hls.destroy();
                    if (window.Hls && window.Hls.isSupported()) {
                        const hls = new window.Hls({ maxBufferLength: 300, enableWorker: true, xhrSetup: function (xhr) { xhr.withCredentials = false; } });
                        hls.loadSource(url); hls.attachMedia(video);
                        hls.on(window.Hls.Events.ERROR, (event, data) => { if (data.fatal) { if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) { hls.destroy(); video.src = url; } else { hls.destroy(); } } });
                        art.hls = hls;
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; }
                },
            },
        });

        art.notice.show = function() {}; 

        const handleSmartFit = () => {
            const video = art.template.$video;
            if (!video) return;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                const isPortrait = video.videoHeight > video.videoWidth; 
                if (isPortrait) {
                    video.style.width = '100%'; video.style.height = '100%'; video.style.objectFit = 'contain';
                } else {
                    video.style.width = '100%'; video.style.height = '100%'; video.style.objectFit = 'fill';
                }
            }
        };

        art.on('ready', () => {
            if (onPlayerReady) onPlayerReady(art);
            handleSmartFit();
            art.on('video:loadedmetadata', handleSmartFit);
            art.on('video:canplay', handleSmartFit);

            const watermarkLayer = art.layers.watermark;
            const moveWatermark = () => {
                if (!watermarkLayer) return;
                const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
                const isPortrait = window.innerHeight > window.innerWidth;
                let minTop = 5, maxTop = 80; if (isTelegram && isPortrait) { minTop = 38; maxTop = 58; }
                watermarkLayer.style.top = `${Math.floor(Math.random()*(maxTop-minTop+1))+minTop}%`;
                watermarkLayer.style.left = `${Math.floor(Math.random()*80)+5}%`;
            };
            moveWatermark();
            const watermarkInterval = setInterval(moveWatermark, 5500);

            const wrapper = art.layers.gestures.querySelector('.gesture-wrapper');
            const zones = wrapper.querySelectorAll('.gesture-zone');
            let clickCount = 0, singleTapTimer = null, accumulateTimer = null;
            zones.forEach(zone => {
                zone.addEventListener('click', (e) => {
                    const action = zone.getAttribute('data-action');
                    if (action === 'toggle') {
                        clickCount++; clearTimeout(singleTapTimer);
                        if (clickCount === 1) singleTapTimer = setTimeout(() => { simulateSingleTap(e); clickCount = 0; }, 300);
                        else { art.toggle(); clickCount = 0; }
                    } else {
                        clickCount++; clearTimeout(singleTapTimer); clearTimeout(accumulateTimer);
                        if (clickCount === 1) singleTapTimer = setTimeout(() => { simulateSingleTap(e); clickCount = 0; }, 250);
                        else {
                            const seconds = (clickCount - 1) * 10;
                            const icon = zone.querySelector('.icon');
                            const isForward = action === 'forward';
                            icon.innerHTML = isForward ? `${seconds} <span style="font-size:1.2em">»</span>` : `<span style="font-size:1.2em">«</span> ${seconds}`;
                            showFeedback(icon);
                            accumulateTimer = setTimeout(() => {
                                if (isForward) art.forward = seconds; else art.backward = seconds;
                                hideFeedback(icon); clickCount = 0;
                                setTimeout(() => { icon.innerHTML = isForward ? `10 <span style="font-size:1.2em">»</span>` : `<span style="font-size:1.2em">«</span> 10`; }, 300);
                            }, 600);
                        }
                    }
                });
            });
            const simulateSingleTap = (e) => {
                const gestureLayer = art.layers.gestures; gestureLayer.style.display = 'none';
                const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
                if (elementBelow) elementBelow.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
                gestureLayer.style.display = 'block';
            };
            const showFeedback = (el) => { if(el) { el.style.opacity = '1'; el.style.transform = 'scale(1.2)'; }};
            const hideFeedback = (el) => { if(el) { el.style.opacity = '0'; el.style.transform = 'scale(1)'; }};

            art.on('destroy', () => clearInterval(watermarkInterval));
        });

        art.on('destroy', () => { if (art.hls) art.hls.destroy(); });
        playerInstance.current = art;
        return () => { if (playerInstance.current) playerInstance.current.destroy(false); };
    }, [libsLoaded, user, videoData]);

    return <div className="artplayer-app" ref={artRef} style={{ width: '100%', height: '100%' }}></div>;
};

// =========================================================================
// 4. مكون Plyr (Online)
// =========================================================================
const YoutubePlyrPlayer = ({ videoData, user }) => {
    const plyrRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const plyrSource = { type: 'video', sources: [{ src: videoData.youtube_video_id, provider: 'youtube' }] };
    
    // ✅ ضبط النسبة 16:7 في الإعدادات
    const plyrOptions = useMemo(() => ({
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['quality', 'speed'],
        fullscreen: { enabled: true, fallback: true, iosNative: true, container: '.player-wrapper' }, 
        youtube: { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 },
        ratio: '16:7', 
    }), []);

    useEffect(() => {
        const player = plyrRef.current?.plyr;
        if (player) {
            const onEnter = () => setIsFullscreen(true);
            const onExit = () => setIsFullscreen(false);
            player.on('enterfullscreen', onEnter);
            player.on('exitfullscreen', onExit);
            return () => {
                player.off('enterfullscreen', onEnter);
                player.off('exitfullscreen', onExit);
            };
        }
    }, [plyrRef]);

    return (
        <div className="plyr-container-div" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Plyr ref={plyrRef} key={videoData.youtube_video_id} source={plyrSource} options={plyrOptions} />
            <PlyrWatermark user={user} isFullscreen={isFullscreen} />
        </div>
    );
};

// =========================================================================
// 5. الصفحة الرئيسية (معدلة)
// =========================================================================
export default function WatchPage() {
    const router = useRouter();
    // [✅] نقرأ فقط معرف الفيديو من الرابط (غير حساس)
    const { videoId } = router.query;
    
    const [videoData, setVideoData] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    const [loading, setLoading] = useState(true);      
    const [libsLoaded, setLibsLoaded] = useState(false); 
    const [viewMode, setViewMode] = useState(null);
    
    useEffect(() => { if (typeof window !== 'undefined' && window.Artplayer && window.Hls) setLibsLoaded(true); }, []);
    
    const artPlayerInstanceRef = useRef(null);
    const playerWrapperRef = useRef(null);

    // ---------------------------------------------------------
    // 1. التحقق من الهوية وجلب البيانات (Headers Only)
    // ---------------------------------------------------------
    useEffect(() => {
        if (!videoId) return; 

        // أ) جلب البيانات من الذاكرة الآمنة
        const uid = localStorage.getItem('auth_user_id');
        const did = localStorage.getItem('auth_device_id');
        const fname = localStorage.getItem('auth_first_name');

        if (!uid || !did) {
             // طرد المستخدم
             router.replace('/login');
             return;
        }

        // تعيين حالة المستخدم للعرض
        setUser({ id: uid, first_name: fname || 'User' });
        
        // التحقق من بيئة الأندرويد
        if (typeof window.Android !== 'undefined') setIsNativeAndroid(true);

        setLoading(true);

        // ب) طلب بيانات الفيديو بالهيدرز
        fetch(`/api/secure/get-video-id?lessonId=${videoId}`, {
            headers: { 
                'x-user-id': uid,
                'x-device-id': did
            }
        })
        .then(res => {
            if (res.status === 403) throw new Error("⛔ تم رفض الوصول (تأكد من الجهاز والاشتراك).");
            if (!res.ok) return res.json().then(e => { throw new Error(e.message); });
            return res.json();
        })
        .then(data => {
            setVideoData(data);
            setViewMode(data.offline_mode === true ? 'native' : 'youtube');
            setLoading(false);
        })
        .catch(err => { 
            setError(err.message); 
            setLoading(false); 
            // إذا كان الخطأ أمني، سجل خروج
            if (err.message.includes("رفض")) {
                localStorage.clear();
                router.replace('/login');
            }
        });
    }, [videoId]);

    const handleDownloadClick = () => {
        if (!window.Android) { alert("يرجى تحديث التطبيق."); return; }
        if (viewMode === 'native' && window.Android.downloadVideoWithQualities && videoData?.availableQualities) {
            try {
                const yId = videoData.youtube_video_id || videoData.youtubeId;
                const vTitle = videoData.db_video_title || videoData.videoTitle || "Video";
                const subjectName = videoData.subject_name || "Unknown Subject";
                const chapterName = videoData.chapter_name || "Unknown Chapter";
                let duration = "0";
                if (artPlayerInstanceRef.current && artPlayerInstanceRef.current.duration) duration = artPlayerInstanceRef.current.duration.toString(); 
                else if (videoData.duration) duration = videoData.duration.toString();

                const qualitiesPayload = videoData.availableQualities.map(q => ({ quality: q.quality, url: q.url }));
                window.Android.downloadVideoWithQualities(yId, vTitle, duration, JSON.stringify(qualitiesPayload), subjectName, chapterName);
            } catch (e) { alert("حدث خطأ: " + e.message); }
        } else { alert("التحميل غير متاح."); }
    };

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    // ✅ تحديد النسبة: 16/7 دائماً لليوتيوب، و 16/9 للوضع الأصلي
    const aspectRatio = viewMode === 'youtube' ? '16/7' : '16/9';

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }} />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" strategy="afterInteractive" onLoad={() => { if (window.Hls) setLibsLoaded(true); }} />

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            {!loading && (
                <div className="player-wrapper" ref={playerWrapperRef}>
                    {viewMode === 'native' && <NativeArtPlayer videoData={videoData} user={user} libsLoaded={libsLoaded} onPlayerReady={(art) => { artPlayerInstanceRef.current = art; }} />}
                    {viewMode === 'youtube' && <YoutubePlyrPlayer videoData={videoData} user={user} />}
                </div>
            )}

            {isNativeAndroid && viewMode === 'native' && (
                <button onClick={handleDownloadClick} className="download-button-native">⬇️ تحميل الفيديو (أوفلاين)</button>
            )}

            <footer className="developer-info"><p>برمجة وتطوير: A7MeD WaLiD</p></footer>

            <style jsx global>{`
                body { margin: 0; background: #000; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; box-sizing: border-box; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: white; background: #000; }
                .loading-overlay { position: absolute; z-index: 50; background: #000; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                
                .player-wrapper { 
                    position: relative; width: 100%; max-width: 900px; 
                    /* ✅ تطبيق النسبة 16:7 */
                    aspect-ratio: ${aspectRatio};
                    background: #111; 
                    overflow: visible !important; 
                    border-radius: 8px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                    transition: aspect-ratio 0.3s ease;
                }

                /* ✅✅✅ إجبار Plyr على احترام النسبة 16:7 عالمياً */
                /* نطبق هذا فقط إذا كانت الحاوية 16:7 (أي وضع يوتيوب) */
                ${viewMode === 'youtube' ? `
                    .player-wrapper .plyr__video-embed,
                    .player-wrapper .plyr__video-wrapper {
                        aspect-ratio: 16/7 !important;
                        padding-bottom: 43.75% !important; /* = (7/16)*100 */
                    }
                    
                    /* تحسين ملء الفيديو داخل الحاوية الجديدة */
                    .player-wrapper .plyr iframe {
                       transform: scale(1.05); /* تكبير بسيط لإخفاء الحواف السوداء المحتملة */
                    }
                ` : ''}
                
                .player-wrapper .plyr { width: 100%; height: 100%; border-radius: 8px; overflow: hidden; }
                .artplayer-app { width: 100%; height: 100%; border-radius: 8px; overflow: hidden; }
                
                .download-button-native { 
                    width: 100%; max-width: 900px; padding: 15px; 
                    background: #38bdf8; border: none; border-radius: 8px; 
                    font-weight: bold; cursor: pointer; color: #111; 
                    margin-top: 20px; display: block; 
                }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }

                /* === إصلاحات Artplayer === */
                .art-setting, .art-layer-setting { z-index: 9999 !important; bottom: 60px !important; }
                .art-bottom { z-index: 9000 !important; }
                .art-notice, .art-control-lock, .art-layer-lock, div[data-art-control="lock"] { display: none !important; }

                /* === إصلاحات Plyr === */
                .plyr__menu__container {
                    z-index: 10000 !important; max-height: 250px !important; overflow-y: auto !important;
                    width: auto !important; min-width: 200px !important; right: 10px !important;
                }

                /* ✅ وضع ملء الشاشة */
                .plyr--fullscreen-active {
                    position: fixed !important;
                    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    z-index: 999999 !important;
                    background: #000 !important;
                    border-radius: 0 !important;
                }
                
                .plyr--fullscreen-active .plyr,
                .plyr--fullscreen-active .plyr__video-wrapper { 
                    width: 100% !important; 
                    height: 100% !important; 
                    border-radius: 0 !important; 
                    padding-bottom: 0 !important;
                    aspect-ratio: unset !important;
                }
                
                .plyr--fullscreen-active .plyr__controls {
                    z-index: 1000000 !important; 
                }

                /* ✅ العلامة المائية لـ Artplayer */
                .watermark-content { 
                    padding: 4px 8px !important; 
                    background: rgba(0, 0, 0, 0.5); 
                    color: rgba(255, 255, 255, 0.7); 
                    border-radius: 4px; 
                    white-space: nowrap; 
                    font-size: 12px !important; 
                    font-weight: bold !important;
                    text-shadow: 1px 1px 2px black; 
                    pointer-events: none; 
                }

                .gesture-wrapper { width: 100%; height: 100%; display: flex; }
                .gesture-zone.left, .gesture-zone.right { width: 30%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone.center { width: 40%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
                .gesture-zone .icon { font-size: 18px; font-weight: bold; font-family: sans-serif; color: rgba(255, 255, 255, 0.9); opacity: 0; transition: opacity 0.2s, transform 0.2s; background: transparent; padding: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); pointer-events: none; }
                .gesture-zone.center .icon { font-size: 30px; }

                .plyr__video-embed iframe { pointer-events: none !important; }
            `}</style>
        </div>
    );
}
