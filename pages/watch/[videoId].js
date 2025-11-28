// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// 1. استيراد Plyr
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// =========================================================================
// 2. مكون العلامة المائية
// =========================================================================
const PlyrWatermark = ({ user }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });

    useEffect(() => {
        if (!user) return;
        const move = () => {
            const isTelegram = !!(typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp);
            const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
            let minTop = 5, maxTop = 80; 
            if (isTelegram && isPortrait) { minTop = 38; maxTop = 58; }
            const t = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
            const l = Math.floor(Math.random() * 80) + 5;
            setPos({ top: `${t}%`, left: `${l}%` });
        };
        const interval = setInterval(move, 5000);
        move();
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div className="plyr-watermark" style={{
            position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999,
            pointerEvents: 'none', padding: '5px 10px', background: 'rgba(0,0,0,0.6)',
            color: 'rgba(255,255,255,0.8)', fontSize: '12px', borderRadius: '5px',
            fontWeight: 'bold', transition: 'top 2s ease, left 2s ease',
            userSelect: 'none', whiteSpace: 'nowrap', textShadow: '1px 1px 2px black'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

// =========================================================================
// 3. مكون مشغل Artplayer (Native - للموبايل)
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
        const title = videoData.db_video_title || "مشاهدة الدرس";

        const art = new window.Artplayer({
            container: artRef.current,
            url: startUrl,
            type: 'm3u8',
            quality: qualityList,
            title: title,
            volume: 1.0,
            isLive: false, muted: false, autoplay: false,
            autoSize: true, autoMini: true, screenshot: false, setting: true,
            loop: false, flip: false, playbackRate: true, aspectRatio: false,
            fullscreen: true, fullscreenWeb: true, miniProgressBar: true,
            mutex: true, backdrop: true, playsInline: true,
            theme: '#38bdf8', lang: 'ar',
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

        art.on('ready', () => { if (onPlayerReady) onPlayerReady(art); });
        art.on('destroy', () => { if (art.hls) art.hls.destroy(); });
        playerInstance.current = art;

        return () => { if (playerInstance.current) playerInstance.current.destroy(false); };
    }, [libsLoaded, user, videoData]);

    return <div className="artplayer-app" ref={artRef} style={{ width: '100%', height: '100%' }}></div>;
};


// =========================================================================
// 4. مكون مشغل Plyr (كمبيوتر/أونلاين) - تم الإصلاح ✅
// =========================================================================
const YoutubePlyrPlayer = ({ videoData, user }) => {
    const ref = useRef(null);
    const [isPaused, setIsPaused] = useState(true);

    const plyrSource = {
        type: 'video',
        sources: [{ src: videoData.youtube_video_id, provider: 'youtube' }],
    };

    const plyrOptions = {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['quality', 'speed'],
        youtube: { noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1, controls: 0 },
        fullscreen: { enabled: true, fallback: true, iosNative: true, container: '.player-wrapper' }
    };

    useEffect(() => {
        // ✅ الإصلاح: التحقق المتكرر حتى يصبح المشغل جاهزاً
        const checkForPlayer = setInterval(() => {
            const player = ref.current?.plyr;
            if (player) {
                // وجدنا المشغل! نوقف البحث ونربط الأحداث
                clearInterval(checkForPlayer);
                
                // تعريف الدوال
                const handlePlay = () => setIsPaused(false);
                const handlePause = () => setIsPaused(true);
                const handleEnded = () => setIsPaused(true);

                // ربط الأحداث
                player.on('play', handlePlay);
                player.on('playing', handlePlay);
                player.on('pause', handlePause);
                player.on('ended', handleEnded);
                
                // تأكد من الحالة الأولية
                if (!player.paused) setIsPaused(false);
            }
        }, 500); // يفحص كل نصف ثانية

        return () => clearInterval(checkForPlayer);
    }, []);

    const handleCoverClick = () => {
        setIsPaused(false); // إخفاء الستارة فوراً
        const player = ref.current?.plyr;
        if (player) {
            // محاولة التشغيل مع تأخير بسيط جداً لضمان الاستجابة
            setTimeout(() => player.play(), 50);
        }
    };

    const posterUrl = `https://img.youtube.com/vi/${videoData.youtube_video_id}/maxresdefault.jpg`;

    return (
        <div className="secure-plyr-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
            
            <Plyr ref={ref} key={videoData.youtube_video_id} source={plyrSource} options={plyrOptions} />
            
            {/* تظهر الستارة فقط إذا كان متوقفاً */}
            {isPaused && (
                <div className="pause-cover" onClick={handleCoverClick}>
                    <div className="big-play-btn">▶</div>
                </div>
            )}
            
            <PlyrWatermark user={user} />

            <style jsx global>{`
                /* منع الضغط على اليوتيوب */
                .secure-plyr-wrapper .plyr__video-embed iframe {
                    pointer-events: none !important;
                }
                
                .pause-cover {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background-image: url('${posterUrl}');
                    background-size: cover; background-position: center;
                    z-index: 60;
                    display: flex; justify-content: center; align-items: center;
                    cursor: pointer;
                    /* أنيميشن ناعم للظهور والاختفاء */
                    transition: opacity 0.2s ease-in-out;
                }
                .pause-cover::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                }
                .big-play-btn {
                    position: relative; z-index: 2;
                    width: 80px; height: 80px;
                    background: #38bdf8; border-radius: 50%;
                    display: flex; justify-content: center; align-items: center;
                    color: white; font-size: 35px; padding-left: 5px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
                    transition: transform 0.2s;
                    pointer-events: none; /* جعل الضغط يمر للحاوية */
                }
                .pause-cover:hover .big-play-btn { transform: scale(1.1); background: #0ea5e9; }
                
                /* رفع أزرار التحكم لتكون متاحة دائماً */
                .plyr__controls { z-index: 70 !important; }
            `}</style>
        </div>
    );
};


// =========================================================================
// 5. الصفحة الرئيسية (WatchPage)
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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(checkMobile);
            if (window.Artplayer && window.Hls) setLibsLoaded(true);
        }
    }, []);
    
    const artPlayerInstanceRef = useRef(null);
    const playerWrapperRef = useRef(null);

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

    useEffect(() => {
        if (!videoId || !user) return; 
        setLoading(true);
        const params = new URLSearchParams(window.location.search);
        const currentDeviceId = params.get('deviceId');

       fetch(`/api/secure/get-video-id?lessonId=${videoId}&userId=${user.id}&deviceId=${currentDeviceId}`)
            .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
            .then(data => {
                setVideoData(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [videoId, user]);

    const handleDownloadClick = () => {
        if (!window.Android) { alert("يرجى تحديث التطبيق."); return; }
        if (videoData?.offline_mode && window.Android.downloadVideoWithQualities && videoData?.availableQualities) {
            try {
                const yId = videoData.youtube_video_id || videoData.youtubeId;
                const vTitle = videoData.db_video_title || videoData.videoTitle || "Video";
                const subjectName = videoData.subject_name || "Unknown Subject";
                const chapterName = videoData.chapter_name || "Unknown Chapter";
                let duration = "0";
                if (artPlayerInstanceRef.current && artPlayerInstanceRef.current.duration) {
                    duration = artPlayerInstanceRef.current.duration.toString(); 
                } else if (videoData.duration) {
                    duration = videoData.duration.toString();
                }
                const qualitiesPayload = videoData.availableQualities.map(q => ({ quality: q.quality, url: q.url }));
                const qualitiesJson = JSON.stringify(qualitiesPayload);
                window.Android.downloadVideoWithQualities(yId, vTitle, duration, qualitiesJson, subjectName, chapterName);
            } catch (e) { alert("حدث خطأ: " + e.message); }
        } else { alert("التحميل غير متاح."); }
    };

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    const shouldUseNativePlayer = isMobile && videoData?.offline_mode === true;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }} />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" strategy="afterInteractive" onLoad={() => { if (window.Hls) setLibsLoaded(true); }} />

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            {!loading && videoData && (
                <div className="player-wrapper" ref={playerWrapperRef}>
                    {shouldUseNativePlayer ? (
                        <NativeArtPlayer 
                            videoData={videoData} 
                            user={user} 
                            libsLoaded={libsLoaded}
                            onPlayerReady={(art) => { artPlayerInstanceRef.current = art; }}
                        />
                    ) : (
                        <YoutubePlyrPlayer videoData={videoData} user={user} />
                    )}
                </div>
            )}

            {isNativeAndroid && videoData?.offline_mode && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info"><p>برمجة وتطوير: A7MeD WaLiD</p></footer>

            <style jsx global>{`
                body { margin: 0; background: #000; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; box-sizing: border-box; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: white; background: #000; }
                .loading-overlay { position: absolute; z-index: 50; background: #000; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                
                .player-wrapper { 
                    position: relative; width: 100%; max-width: 900px; 
                    aspect-ratio: 16/9; background: #111; border-radius: 8px; overflow: hidden; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }
                .player-wrapper:fullscreen, .player-wrapper:-webkit-full-screen, .player-wrapper:-moz-full-screen {
                    width: 100%; height: 100%; max-width: none; aspect-ratio: auto; background: #000;
                    display: flex; align-items: center; justify-content: center;
                }
                .player-wrapper .plyr { width: 100%; height: 100%; }
                .artplayer-app { width: 100%; height: 100%; }
                .download-button-native { 
                    width: 100%; max-width: 900px; padding: 15px; 
                    background: #38bdf8; border: none; border-radius: 8px; 
                    font-weight: bold; cursor: pointer; color: #111; 
                    margin-top: 20px; display: block; 
                }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }
                .art-bottom { z-index: 100 !important; }
                .art-notice, .art-control-lock, .art-layer-lock, div[data-art-control="lock"] { display: none !important; }
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
