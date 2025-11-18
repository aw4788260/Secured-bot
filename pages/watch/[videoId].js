import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// مكون العلامة المائية
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
    
    // States
    const [streamUrl, setStreamUrl] = useState(null); 
    const [youtubeId, setYoutubeId] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [videoTitle, setVideoTitle] = useState("جاري التحميل...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    // Refs
    const artRef = useRef(null);
    const playerInstance = useRef(null);

    // ##############################
    //  1. نفس كود جلب البيانات القديم (Plyr Version)
    // ##############################
    useEffect(() => {
        // إعداد المستخدم
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
        } 
        else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u);
            else setError("يرجى الفتح من تليجرام.");
        } 
        else {
            setError("يرجى الفتح من التطبيق المخصص.");
        }

        // جلب الفيديو
        if (videoId) {
            // تدمير البلاير القديم لتجنب التداخل
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
                playerInstance.current = null;
            }
            setStreamUrl(null); // تصفير الرابط
            
            // نفس الـ Fetch الذي كان يعمل سابقاً
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => {
                    if (!res.ok) return res.json().then(e => { throw new Error(e.message); });
                    return res.json();
                })
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    
                    // تخزين البيانات
                    setStreamUrl(data.streamUrl);
                    setYoutubeId(data.youtube_video_id);
                    setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);


    // ##############################
    //  2. تشغيل Artplayer (مع حل مشكلة التحميل)
    // ##############################
    useEffect(() => {
        // لا نبدأ إلا إذا توفر الرابط وعنصر الـ DIV
        if (!streamUrl || !artRef.current || typeof window === 'undefined') return;

        const initPlayer = () => {
            // انتظار تحميل المكتبات من الـ CDN
            if (!window.Artplayer || !window.Hls) {
                setTimeout(initPlayer, 100); 
                return;
            }

            // تنظيف أي نسخة سابقة
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
            }

            const art = new window.Artplayer({
                container: artRef.current,
                url: streamUrl,
                title: videoTitle,
                volume: 0.7,
                isLive: false,
                muted: false, // حاول ألا تكتم الصوت
                autoplay: false, // لا تفعل التشغيل التلقائي لتجنب مشاكل المتصفح
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
                
                // إعدادات HLS المخصصة
                type: 'm3u8',
                customType: {
                    m3u8: function (video, url, art) {
                        if (window.Hls.isSupported()) {
                            const hlsConfig = {
                                debug: false,
                                enableWorker: true,
                                maxBufferLength: 30,
                                maxMaxBufferLength: 600,
                            };
                            
                            const hls = new window.Hls(hlsConfig);
                            
                            // الترتيب الصحيح: ربط الفيديو أولاً ثم تحميل المصدر
                            hls.attachMedia(video);
                            hls.on(window.Hls.Events.MEDIA_ATTACHED, function () {
                                hls.loadSource(url);
                            });

                            // عند جاهزية المانيفست (قائمة التشغيل)
                            hls.on(window.Hls.Events.MANIFEST_PARSED, function (event, data) {
                                // 1. استخراج الجودات
                                const qualities = data.levels.map((level, index) => {
                                    return {
                                        default: false,
                                        html: level.height + 'p',
                                        url: url,
                                        levelIndex: index
                                    };
                                });
                                qualities.unshift({ default: true, html: 'Auto', url: url, levelIndex: -1 });
                                
                                // 2. تحديث القائمة
                                art.quality = qualities;

                                // 3. [هام] إجبار إخفاء اللودر لأن الفيديو جاهز
                                art.loading.show = false;
                                
                                // 4. (اختياري) محاولة التشغيل إذا لم يكن هناك تفاعل
                                // art.play().catch(() => console.log("Autoplay blocked by browser"));
                            });

                            // معالجة الأخطاء لإعادة المحاولة
                            hls.on(window.Hls.Events.ERROR, function (event, data) {
                                if (data.fatal) {
                                    switch (data.type) {
                                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                                            hls.startLoad(); // محاولة إعادة التحميل
                                            break;
                                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                                            hls.recoverMediaError();
                                            break;
                                        default:
                                            hls.destroy();
                                            break;
                                    }
                                }
                            });

                            // ربط قائمة الجودة بـ HLS
                            art.on('video:quality', (newQuality) => {
                                hls.currentLevel = newQuality.levelIndex;
                            });

                            // تنظيف الذاكرة
                            art.on('destroy', () => hls.destroy());

                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            // Safari
                            video.src = url;
                            // إجبار إخفاء اللودر في سفاري أيضاً
                            video.addEventListener('loadedmetadata', () => {
                                art.loading.show = false;
                            });
                        } else {
                            art.notice.show = 'المتصفح لا يدعم هذا الفيديو';
                        }
                    },
                },
            });

            // إجبار اللودر على الاختفاء بعد 5 ثواني في أسوأ الظروف
            // كحل أخير إذا فشل كل شيء
            setTimeout(() => {
                if (art && art.loading && art.loading.show) {
                    art.loading.show = false;
                }
            }, 5000);

            playerInstance.current = art;
        };

        initPlayer();

        // تنظيف عند الخروج
        return () => {
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
                playerInstance.current = null;
            }
        };
    }, [streamUrl]); // إعادة البناء عند تغير الرابط فقط


    // زر التحميل للأندرويد
    const handleDownloadClick = () => {
        if (!youtubeId) return alert("انتظر..");
        if (isNativeAndroid) {
            try { window.Android.downloadVideo(youtubeId, videoTitle); } 
            catch { alert("خطأ في الاتصال."); }
        } else {
            alert("متاح فقط في التطبيق.");
        }
    };

    // حالات التحميل والخطأ الأولية
    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                {/* مكتبات التشغيل CDN */}
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
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center;
                    min-height: 100vh; 
                    padding: 10px; 
                    position: relative;
                }
                
                .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; }
                
                .player-wrapper { 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: 16/9; 
                    background: #000; 
                    position: relative; 
                    margin-bottom: 0;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }

                .artplayer-container {
                    width: 100%;
                    height: 100%;
                }

                .download-button-native { 
                    width: 100%; 
                    max-width: 900px; 
                    padding: 15px; 
                    background: #38bdf8; 
                    border: none; 
                    border-radius: 8px; 
                    font-weight: bold; 
                    cursor: pointer; 
                    color: #111; 
                    margin-top: 20px; 
                }

                .developer-info {
                    position: absolute;
                    bottom: 10px;
                    width: 100%;
                    text-align: center;
                    font-size: 0.85rem;
                    color: #777;
                }
                .developer-info a { color: #38bdf8; text-decoration: none; }
            `}</style>
        </div>
    );
}
