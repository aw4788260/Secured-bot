// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// استدعاء Plyr (للوضع الأونلاين)
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// =========================================================================
// 1. مكون العلامة المائية (الخاص بوضع اليوتيوب - Plyr)
// =========================================================================
const WatermarkPlyr = ({ user }) => {
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const watermarkIntervalRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        const moveWatermark = () => {
             const newTop = Math.floor(Math.random() * 70) + 10;
             const newLeft = Math.floor(Math.random() * 70) + 10;
             setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        };
        moveWatermark();
        watermarkIntervalRef.current = setInterval(moveWatermark, 5000);
        return () => clearInterval(watermarkIntervalRef.current);
    }, [user]);

    return (
        <div className="watermark-plyr" style={{
            position: 'absolute', top: watermarkPos.top, left: watermarkPos.left,
            zIndex: 100, pointerEvents: 'none', padding: '5px 10px',
            background: 'rgba(0, 0, 0, 0.6)', color: 'rgba(255, 255, 255, 0.8)',
            fontSize: 'clamp(12px, 2.5vw, 16px)', borderRadius: '6px',
            fontWeight: 'bold', transition: 'top 2s ease-in-out, left 2s ease-in-out',
            whiteSpace: 'nowrap', textShadow: '1px 1px 2px black', fontFamily: 'sans-serif'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

// =========================================================================
// 2. مشغل الوضع الخاص (Artplayer - OfflineOn)
// ✅ تم نسخ المنطق حرفياً من كودك الأصلي (اللمس التراكمي، العلامة، التحميل)
// =========================================================================
const NativePlayerView = ({ videoData, user, isNativeAndroid }) => {
    const artRef = useRef(null);
    const playerInstance = useRef(null);
    const [libsLoaded, setLibsLoaded] = useState(false);

    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        return standards.reduce((prev, curr) => (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev)).toString();
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Artplayer && window.Hls) {
            setLibsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!libsLoaded || !user || !videoData || !artRef.current || !window.Artplayer) return;

        if (playerInstance.current) {
            playerInstance.current.destroy(false);
            playerInstance.current = null;
        }

        let qualities = videoData.availableQualities || [];
        if (qualities.length === 0) return;

        qualities = qualities.sort((a, b) => b.quality - a.quality);
        const middleIndex = Math.floor((qualities.length - 1) / 2);

        const qualityList = qualities.map((q, index) => ({
            default: index === middleIndex,
            html: normalizeQuality(q.quality),
            url: q.url,
        }));

        const startUrl = qualityList[middleIndex]?.url || qualityList[0]?.url;
        const title = videoData.db_video_title || "مشاهدة الدرس";

        // إعداد المشغل (نفس إعدادات كودك الأصلي)
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
            
            // طبقات العلامة المائية واللمس (كما في الكود الأصلي)
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
                            maxBufferLength: 300, enableWorker: true,
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
            // 1. منطق العلامة المائية (نفس الكود الأصلي)
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

            // 2. منطق اللمس المتقدم والتراكمي (نفس الكود الأصلي)
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

                    // --- الجوانب (تقديم/تأخير تراكمي) ---
                    clickCount++;
                    clearTimeout(singleTapTimer);
                    clearTimeout(accumulateTimer); 

                    if (clickCount === 1) {
                        singleTapTimer = setTimeout(() => {
                            simulateSingleTap(e);
                            clickCount = 0;
                        }, 250);
                    } else {
                        // نقرتين أو أكثر
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

            const showFeedback = (el) => {
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

        art.on('destroy', () => { if (art.hls) art.hls.destroy(); });
        playerInstance.current = art;

        return () => { if (playerInstance.current) playerInstance.current.destroy(false); };
    }, [libsLoaded, user, videoData]);

    // دالة التحميل كما في الكود الأصلي (مع التعديلات للباك إند الجديد)
    const handleDownloadClick = () => {
        if (window.Android && window.Android.downloadVideoWithQualities) {
            if (videoData && videoData.availableQualities && videoData.availableQualities.length > 0) {
                try {
                    const yId = videoData.youtube_video_id;
                    const vTitle = videoData.db_video_title || "Video";
                    const subjectName = videoData.subject_name || "Unknown Subject";
                    const chapterName = videoData.chapter_name || "Unknown Chapter";
                    let duration = "0";
                    if (playerInstance.current && playerInstance.current.duration) {
                        duration = playerInstance.current.duration.toString(); 
                    } else if (videoData.duration) {
                        duration = videoData.duration.toString();
                    }
                    const qualitiesJson = JSON.stringify(videoData.availableQualities.map(q => ({
                        quality: q.quality,
                        url: q.url
                    })));

                    window.Android.downloadVideoWithQualities(yId, vTitle, duration, qualitiesJson, subjectName, chapterName);
                } catch (e) { alert("حدث خطأ: " + e.message); }
            } else { alert("بيانات الفيديو غير مكتملة."); }
        } else { alert("يرجى تحديث التطبيق."); }
    };

    return (
        <>
            <Script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js" strategy="afterInteractive" onLoad={() => { if (window.Artplayer) setLibsLoaded(true); }} />
            <Script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js" strategy="afterInteractive" onLoad={() => { if (window.Hls) setLibsLoaded(true); }} />
            
            <div className="player-wrapper art-wrapper">
                <div ref={artRef} className="artplayer-app"></div>
            </div>
            
            {/* زر التحميل يظهر فقط هنا */}
            {isNativeAndroid && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}
        </>
    );
};

// =========================================================================
// 3. مشغل اليوتيوب (Plyr - OfflineOff)
// ✅ تم الحفاظ على الإصلاح (Portal + Key) ليعمل الفيديو والعلامة المائية
// =========================================================================
const YoutubePlayerView = ({ videoData, user }) => {
    const youtubeId = videoData.youtube_video_id;
    const [plyrContainer, setPlyrContainer] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            const container = document.querySelector('.plyr-wrapper .plyr');
            if (container) {
                setPlyrContainer(container);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [youtubeId]);

    const plyrSource = {
        type: 'video',
        sources: [{ src: youtubeId, provider: 'youtube' }],
    };

    const plyrOptions = {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['quality', 'speed'],
        youtube: { rel: 0, showinfo: 0, modestbranding: 1, controls: 0 }
    };

    return (
        <>
            <div className="player-wrapper plyr-wrapper">
                <Plyr key={youtubeId} source={plyrSource} options={plyrOptions} />
                {plyrContainer && createPortal(<WatermarkPlyr user={user} />, plyrContainer)}
            </div>

            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
                <p>برمجة وتطوير: A7MeD WaLiD</p>
                <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>
        </>
    );
};

// =========================================================================
// 4. الصفحة الرئيسية
// =========================================================================
export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [videoData, setVideoData] = useState(null);
    const [viewMode, setViewMode] = useState(null); 
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);

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

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            {!loading && viewMode === 'native' && (
                <NativePlayerView videoData={videoData} user={user} isNativeAndroid={isNativeAndroid} />
            )}

            {!loading && viewMode === 'youtube' && (
                <YoutubePlayerView videoData={videoData} user={user} />
            )}

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; overscroll-behavior: contain; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; position: relative; box-sizing: border-box; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; color: white;}
                .loading-overlay { position: absolute; z-index: 50; background: rgba(0,0,0,0.8); width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-size: 1.2rem; }
                
                .player-wrapper { width: 100%; max-width: 900px; background: #000; position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                
                .art-wrapper { aspect-ratio: 16/9; }
                .artplayer-app { width: 100%; height: 100%; }

                .plyr-wrapper { aspect-ratio: 16/7; }
                .plyr-wrapper .plyr { width: 100%; height: 100%; }

                .download-button-native { width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; display: block; transition: background 0.3s; }
                .download-button-native:hover { background-color: #7dd3fc; }
                
                .developer-info { width: 100%; text-align: center; font-size: 0.85rem; color: #777; margin-top: 20px; }
                .developer-info a { color: #38bdf8; text-decoration: none; }

                /* CSS الخاص بـ Artplayer كما في الكود الأصلي */
                .art-notice, .art-control-lock, .art-layer-lock, div[data-art-control="lock"] { display: none !important; }

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

                .gesture-wrapper {
                    width: 100%; height: 100%;
                    display: flex;
                }
                
                .gesture-zone.left, .gesture-zone.right {
                    width: 30%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    pointer-events: auto;
                }
                .gesture-zone.center {
                    width: 40%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    pointer-events: auto;
                }

                .gesture-zone .icon { 
                    font-size: 18px; font-weight: bold; font-family: sans-serif; 
                    color: rgba(255, 255, 255, 0.9);
                    opacity: 0; 
                    transition: opacity 0.2s, transform 0.2s;
                    background: transparent; 
                    padding: 10px; 
                    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                    pointer-events: none;
                }
                
                .gesture-zone.center .icon {
                    font-size: 30px;
                }
            `}</style>
        </div>
    );
}
