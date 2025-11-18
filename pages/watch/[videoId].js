import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

const Watermark = ({ user }) => {
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
            if (watermarkIntervalRef.current) clearInterval(watermarkIntervalRef.current); 
        };
    }, [user]);

    return (
        <div className="watermark" style={{ 
            position: 'absolute', top: watermarkPos.top, left: watermarkPos.left,
            zIndex: 20, pointerEvents: 'none', padding: '4px 8px', 
            background: 'rgba(0, 0, 0, 0.7)', color: 'white', 
            fontSize: 'clamp(10px, 2.5vw, 14px)', borderRadius: '4px',
            fontWeight: 'bold', transition: 'top 2s ease-in-out, left 2s ease-in-out',
            whiteSpace: 'nowrap'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [streamUrl, setStreamUrl] = useState(null); 
    const [youtubeId, setYoutubeId] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [videoTitle, setVideoTitle] = useState("جاري التحميل...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // ##############################
    // 1. جلب البيانات (مع المحافظة على كودك)
    // ##############################
    useEffect(() => {
        const setupUser = (u) => {
            if (u && u.id) setUser(u);
            else setError("خطأ: لا يمكن التعرف على المستخدم.");
        };

        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        const urlFirstName = params.get("firstName");

        if (urlUserId) {
            setupUser({ id: urlUserId, first_name: urlFirstName || "User" });
            if (window.Android) setIsNativeAndroid(true);
        } else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u);
            else setError("يرجى الفتح من تليجرام.");
        } else {
            setError("يرجى الفتح من التطبيق المخصص.");
        }

        if (videoId) {
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
                playerInstance.current = null;
            }
            setStreamUrl(null);
            
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    
                    // تنظيف الرابط من أي مسافات زائدة قد تسبب مشاكل
                    const cleanUrl = data.streamUrl ? data.streamUrl.trim() : null;
                    
                    setStreamUrl(cleanUrl);
                    setYoutubeId(data.youtube_video_id);
                    setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);


    // ##############################
    // 2. تشغيل الفيديو (Artplayer Configured for Google Video)
    // ##############################
    useEffect(() => {
        if (!streamUrl || !artRef.current || typeof window === 'undefined') return;

        const initPlayer = () => {
            if (!window.Artplayer || !window.Hls) {
                setTimeout(initPlayer, 100); 
                return;
            }

            if (playerInstance.current) {
                playerInstance.current.destroy(false);
            }

            const art = new window.Artplayer({
                container: artRef.current,
                url: streamUrl,
                title: videoTitle,
                volume: 0.7,
                isLive: false,
                muted: false,
                autoplay: false,
                pip: true,
                autoSize: false,
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
                autoPlayback: true,
                airplay: true,
                theme: '#38bdf8',
                lang: 'ar',
                
                type: 'm3u8',
                customType: {
                    m3u8: function (video, url, art) {
                        if (window.Hls.isSupported()) {
                            const hlsConfig = {
                                debug: false, // غيرها لـ true لو عاوز تشوف اللوج
                                enableWorker: true,
                                // إعدادات هامة لروابط جوجل
                                xhrSetup: function (xhr, url) {
                                    xhr.withCredentials = false; // منع إرسال الكوكيز لتجنب مشاكل CORS
                                }
                            };
                            
                            const hls = new window.Hls(hlsConfig);
                            
                            hls.attachMedia(video);
                            hls.on(window.Hls.Events.MEDIA_ATTACHED, function () {
                                hls.loadSource(url);
                            });

                            hls.on(window.Hls.Events.MANIFEST_PARSED, function (event, data) {
                                // إخفاء اللودر فوراً عند نجاح قراءة الرابط
                                art.loading.show = false;

                                const qualities = data.levels.map((level, index) => {
                                    return {
                                        default: false,
                                        html: level.height + 'p',
                                        url: url,
                                        levelIndex: index
                                    };
                                });
                                qualities.unshift({ default: true, html: 'Auto', url: url, levelIndex: -1 });
                                art.quality = qualities;
                            });

                            // معالجة الأخطاء الشاملة
                            hls.on(window.Hls.Events.ERROR, function (event, data) {
                                // في حالة أي خطأ، نخفي اللودر حتى لا يعلق المشغل
                                if(data.fatal) {
                                     art.loading.show = false;
                                }

                                if (data.fatal) {
                                    switch (data.type) {
                                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                                            console.error("Network Error: Possibly IP Block or CORS", data);
                                            // محاولة أخيرة للإنعاش
                                            hls.startLoad(); 
                                            break;
                                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                                            console.error("Media Error", data);
                                            hls.recoverMediaError();
                                            break;
                                        default:
                                            console.error("Fatal Error", data);
                                            hls.destroy();
                                            // إظهار رسالة للمستخدم داخل المشغل
                                            art.notice.show = 'فشل تحميل الفيديو. قد يكون الرابط محظوراً أو منتهي الصلاحية.';
                                            break;
                                    }
                                }
                                
                                // فحص خاص لخطأ 403 (Forbidden)
                                if (data.response && data.response.code === 403) {
                                    art.notice.show = 'خطأ 403: الرابط مرتبط بـ IP السيرفر ولا يعمل عند المستخدم.';
                                    hls.destroy();
                                }
                            });

                            art.on('video:quality', (newQuality) => {
                                hls.currentLevel = newQuality.levelIndex;
                            });

                            art.on('destroy', () => hls.destroy());

                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                            video.addEventListener('loadedmetadata', () => { art.loading.show = false; });
                            video.addEventListener('error', () => { art.loading.show = false; });
                        } else {
                            art.loading.show = false;
                            art.notice.show = 'المتصفح لا يدعم هذا الفيديو';
                        }
                    },
                },
            });

            playerInstance.current = art;
        };

        initPlayer();

        return () => {
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
                playerInstance.current = null;
            }
        };
    }, [streamUrl]); 


    const handleDownloadClick = () => {
        if (!youtubeId) return alert("انتظر..");
        if (isNativeAndroid) {
            try { window.Android.downloadVideo(youtubeId, videoTitle); } 
            catch { alert("خطأ في الاتصال."); }
        } else {
            alert("متاح فقط في التطبيق.");
        }
    };

    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                
                {/* هذا التاج مهم جداً لروابط جوجل فيديو */}
                <meta name="referrer" content="no-referrer" />
                
                <script src="https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
            </Head>

            <div className="player-wrapper">
                <div ref={artRef} className="artplayer-container"></div>
                <Watermark user={user} />
            </div>

            {isNativeAndroid && (
                <button onClick={handleDownloadClick} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info">
                <p>برمجة وتطوير: A7MeD WaLiD</p>
                <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank">اضغط هنا</a></p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; }
                .page-container { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    min-height: 100vh; padding: 10px; position: relative;
                }
                .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; }
                .player-wrapper { 
                    width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; 
                    position: relative; margin-bottom: 0; border-radius: 8px; overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .artplayer-container { width: 100%; height: 100%; }
                .download-button-native { 
                    width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; 
                    border: none; border-radius: 8px; font-weight: bold; cursor: pointer; 
                    color: #111; margin-top: 20px; 
                }
                .developer-info {
                    position: absolute; bottom: 10px; width: 100%; text-align: center;
                    font-size: 0.85rem; color: #777;
                }
                .developer-info a { color: #38bdf8; text-decoration: none; }
            `}</style>
        </div>
    );
}
