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

    const normalizeQuality = (val) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const standards = [144, 240, 360, 480, 720, 1080];
        const closest = standards.reduce((prev, curr) => {
            return (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev);
        });
        return closest.toString();
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Artplayer && window.Hls) {
            setLibsLoaded(true);
        }
    }, []);

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
                
                qualities = qualities.sort((a, b) => b.quality - a.quality);
                const middleIndex = Math.floor((qualities.length - 1) / 2);

                const qualityList = qualities.map((q, index) => ({
                    default: index === middleIndex,
                    html: normalizeQuality(q.quality),
                    url: q.url,
                }));
                
                const startUrl = qualityList[middleIndex]?.url || qualityList[0].url;

                if (!artRef.current || !window.Artplayer) return;

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
                    <span class="icon">10 <span style="font-size:1.2em">«</span></span>
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
                                    // ✅✅ تم التعديل هنا: التحميل المسبق 300 ثانية
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

                    const wrapper = art.layers.gestures.querySelector('.gesture-wrapper');
                    const zones = wrapper.querySelectorAll('.gesture-zone');
                    
                    let clickTimer = null;

                    zones.forEach(zone => {
                        zone.addEventListener('click', (e) => {
                            const now = new Date().getTime();
                            const lastTouch = parseInt(zone.getAttribute('data-last-touch') || '0');
                            const diff = now - lastTouch;
                            const action = zone.getAttribute('data-action');

                            if (diff < 300) {
                                clearTimeout(clickTimer);
                                if (action === 'backward') {
                                    art.backward = 10;
                                    showFeedback(zone.querySelector('.icon'));
                                } else if (action === 'forward') {
                                    art.forward = 10;
                                    showFeedback(zone.querySelector('.icon'));
                                } else if (action === 'toggle') {
                                    art.toggle(); 
                                }
                            } else {
                                clickTimer = setTimeout(() => {
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
                                }, 300);
                            }
                            zone.setAttribute('data-last-touch', now);
                        });
                    });

                    const showFeedback = (el) => {
                        if (!el) return;
                        el.style.opacity = '1';
                        el.style.transform = 'scale(1.2)';
                        setTimeout(() => {
                            el.style.opacity = '0';
                            el.style.transform = 'scale(1)';
                        }, 400);
                    };

                    art.on('destroy', () => clearInterval(watermarkInterval));
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
    }, [videoId, libsLoaded, user]); 

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
                    alert("حدث خطأ: " + e.message);
                }
            } else {
                alert("بيانات الفيديو غير مكتملة.");
            }
        } else {
            alert("التحميل متاح من التطبيق فقط.");
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
                    direction: ltr;
                }
                
                .gesture-zone.center .icon {
                    font-size: 30px;
                }
            `}</style>
        </div>
    );
}
