// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// 1. استيراد Plyr (للوضع الأونلاين/الكمبيوتر)
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// =========================================================================
// 2. مكون العلامة المائية (مشترك)
// =========================================================================
const Watermark = ({ user }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });

    useEffect(() => {
        if (!user) return;
        const move = () => {
            const minTop = 10, maxTop = 80;
            const t = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
            const l = Math.floor(Math.random() * 80) + 5;
            setPos({ top: `${t}%`, left: `${l}%` });
        };
        const interval = setInterval(move, 5000);
        move();
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div style={{
            position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999,
            pointerEvents: 'none', padding: '5px 10px', background: 'rgba(0,0,0,0.6)',
            color: 'rgba(255,255,255,0.7)', fontSize: '13px', borderRadius: '5px',
            fontWeight: 'bold', transition: 'top 2s ease, left 2s ease',
            userSelect: 'none', whiteSpace: 'nowrap', textShadow: '1px 1px 2px black'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

// =========================================================================
// 3. مشغل الموبايل (Native Artplayer - m3u8) - كما هو
// =========================================================================
const MobilePlayer = ({ videoData, user, isArtReady }) => {
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        return standards.reduce((prev, curr) => (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev)).toString();
    };

    useEffect(() => {
        if (!isArtReady || !user || !videoData || !artRef.current || !window.Artplayer) return;

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

        const art = new window.Artplayer({
            container: artRef.current,
            url: startUrl,
            quality: qualityList,
            title: videoData.db_video_title || "Lesson",
            volume: 1.0,
            isLive: false, muted: false, autoplay: false,
            autoSize: true, autoMini: true, screenshot: false, setting: true,
            fullscreen: true, fullscreenWeb: true, miniProgressBar: true,
            mutex: true, backdrop: true, playsInline: true,
            theme: '#38bdf8', lang: 'ar',
            customType: {
                m3u8: function (video, url) { video.src = url; } 
            },
        });

        playerInstance.current = art;
        return () => { if (playerInstance.current) playerInstance.current.destroy(false); };
    }, [user, videoData, isArtReady]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div className="artplayer-app" ref={artRef} style={{ width: '100%', height: '100%' }}></div>
            <Watermark user={user} />
        </div>
    );
};

// =========================================================================
// 4. مشغل الكمبيوتر (Plyr with Pause Cover) - التعديل الجديد
// =========================================================================
const DesktopPlayer = ({ videoData, user }) => {
    const plyrRef = useRef(null);
    // حالة لتتبع هل الفيديو متوقف أم لا
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

    // ربط الأحداث لإظهار/إخفاء الستارة
    useEffect(() => {
        const player = plyrRef.current?.plyr;
        if (player) {
            player.on('pause', () => setIsPaused(true));
            player.on('ended', () => setIsPaused(true));
            player.on('play', () => setIsPaused(false));
            player.on('playing', () => setIsPaused(false));
        }
    }, [plyrRef.current]);

    // وظيفة لتشغيل الفيديو عند الضغط على الستارة
    const handleCoverClick = () => {
        const player = plyrRef.current?.plyr;
        if (player) {
            player.play();
        }
    };

    // رابط الصورة المصغرة (Thumbnail)
    const posterUrl = `https://img.youtube.com/vi/${videoData.youtube_video_id}/maxresdefault.jpg`;

    return (
        <div className="desktop-player-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
            
            <Plyr ref={plyrRef} key={videoData.youtube_video_id} source={plyrSource} options={plyrOptions} />
            
            {/* ✅ ستارة التوقف: تظهر فقط عندما يكون الفيديو متوقفاً */}
            {isPaused && (
                <div className="pause-cover" onClick={handleCoverClick}>
                    {/* زر تشغيل كبير في المنتصف */}
                    <div className="big-play-btn">▶</div>
                </div>
            )}
            
            <Watermark user={user} />

            <style jsx>{`
                .pause-cover {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background-image: url('${posterUrl}');
                    background-size: cover;
                    background-position: center;
                    z-index: 60; /* أعلى من اليوتيوب */
                    display: flex; justify-content: center; align-items: center;
                    cursor: pointer;
                }
                /* طبقة سوداء خفيفة فوق الصورة لجعل الزر واضحاً */
                .pause-cover::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.4);
                }
                .big-play-btn {
                    position: relative; z-index: 2;
                    width: 70px; height: 70px;
                    background: #38bdf8; border-radius: 50%;
                    display: flex; justify-content: center; align-items: center;
                    color: white; font-size: 30px; padding-left: 5px; /* تصحيح بصري للمثلث */
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    transition: transform 0.2s;
                }
                .pause-cover:hover .big-play-btn {
                    transform: scale(1.1);
                    background: #0ea5e9;
                }
            `}</style>
        </div>
    );
};

// =========================================================================
// 5. الصفحة الرئيسية
// =========================================================================
export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [videoData, setVideoData] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // ✅ المتغير السحري للفصل بين الأجهزة
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [artReady, setArtReady] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const ua = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            setIsMobileDevice(isMobile);
            if (isMobile && window.Artplayer) setArtReady(true);
        }
    }, []);

    useEffect(() => {
        const setupUser = (u) => { if (u && u.id) setUser(u); else setError("User not found."); };
        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        if (urlUserId) {
            setupUser({ id: urlUserId, first_name: params.get("firstName") || "User" });
        } else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u);
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
        if (window.Android && window.Android.downloadVideoWithQualities && videoData?.availableQualities) {
            try {
                const qualitiesJson = JSON.stringify(videoData.availableQualities.map(q => ({ quality: q.quality, url: q.url })));
                window.Android.downloadVideoWithQualities(
                    videoData.youtube_video_id || videoData.youtubeId,
                    videoData.db_video_title || "Video",
                    videoData.duration ? videoData.duration.toString() : "0",
                    qualitiesJson,
                    videoData.subject_name || "Subject",
                    videoData.chapter_name || "Chapter"
                );
            } catch (e) { alert("Error: " + e.message); }
        } else { alert("Not supported."); }
    };

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <Script 
                src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" 
                strategy="afterInteractive" 
                onLoad={() => setArtReady(true)} 
            />

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            {!loading && videoData && (
                <div className={`player-wrapper ${isMobileDevice ? 'mobile-mode' : 'desktop-mode'}`}>
                    {isMobileDevice ? (
                        <MobilePlayer 
                            videoData={videoData} 
                            user={user} 
                            isArtReady={artReady} 
                        />
                    ) : (
                        <DesktopPlayer videoData={videoData} user={user} />
                    )}
                </div>
            )}

            {isMobileDevice && typeof window !== 'undefined' && window.Android && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <style jsx global>{`
                body { margin: 0; background: #000; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; box-sizing: border-box; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: white; background: #000; }
                .loading-overlay { position: absolute; z-index: 50; background: #000; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                
                .player-wrapper { 
                    position: relative; width: 100%; max-width: 900px; 
                    background: #111; border-radius: 8px; overflow: hidden; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }

                .mobile-mode { aspect-ratio: 16/9; }
                .desktop-mode { aspect-ratio: 16/9; } 

                .download-button-native { 
                    width: 100%; max-width: 900px; padding: 15px; 
                    background: #38bdf8; border: none; border-radius: 8px; 
                    font-weight: bold; cursor: pointer; color: #111; 
                    margin-top: 20px; display: block; 
                }

                /* ✅ إخفاء تام لتفاعلات اليوتيوب في الخلفية */
                .desktop-player-container .plyr__video-embed iframe {
                    pointer-events: none !important;
                }
                .plyr__controls {
                    z-index: 70 !important; /* أعلى من الستارة */
                }
            `}</style>
        </div>
    );
}
