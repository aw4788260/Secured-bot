import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// استيراد Plyr بدون SSR
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// مكون العلامة المائية (كما هو)
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
            zIndex: 15, pointerEvents: 'none', padding: '4px 8px', 
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
    const [qualities, setQualities] = useState([]); // قائمة الجودات وروابطها
    const [currentStreamUrl, setCurrentStreamUrl] = useState(null); // الرابط الحالي
    
    const [youtubeId, setYoutubeId] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [videoTitle, setVideoTitle] = useState("جاري التحميل...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const plyrRef = useRef(null);
    const hlsRef = useRef(null);

    // ##############################
    //   تهيئة المشغل HLS مع Plyr
    // ##############################
    const initPlayer = useCallback(() => {
        if (!currentStreamUrl || qualities.length === 0) return;

        const video = plyrRef.current?.plyr?.media;
        const player = plyrRef.current?.plyr;

        if (!video || !player) return;

        if (window.Hls && window.Hls.isSupported()) {
            // 1. تنظيف HLS القديم إذا وجد
            if (hlsRef.current) {
                // لا نقوم بالتدمير الكامل هنا للحفاظ على الاستمرارية، بل نستخدم loadSource
            } else {
                // إنشاء HLS جديد لأول مرة
                const hls = new window.Hls({
                    maxBufferLength: 30,
                    enableWorker: true,
                    xhrSetup: function (xhr, url) {
                        xhr.withCredentials = false;
                    }
                });
                hlsRef.current = hls;
                hls.attachMedia(video);
            }

            const hls = hlsRef.current;
            
            // 2. تحميل الرابط الحالي
            hls.loadSource(currentStreamUrl);

            // 3. إعداد قائمة الجودة في Plyr
            // نستخرج الأرقام فقط (1080, 720...)
            const qualityOptions = qualities.map(q => q.quality);

            player.config.quality = {
                default: qualities[0].quality, // أعلى جودة كافتراضي
                options: qualityOptions,
                forced: true,
                onChange: (newQuality) => {
                    // عند تغيير الجودة من القائمة
                    const selected = qualities.find(q => q.quality === newQuality);
                    if (selected && selected.url !== currentStreamUrl) {
                        console.log("Switching quality to:", newQuality);
                        
                        // حفظ التوقيت الحالي
                        const currentTime = player.currentTime;
                        const isPaused = player.paused;

                        // تحديث الرابط في State وفي HLS
                        setCurrentStreamUrl(selected.url);
                        hls.loadSource(selected.url);
                        
                        // استعادة التوقيت بعد التحميل
                        hls.once(window.Hls.Events.MANIFEST_PARSED, () => {
                            player.currentTime = currentTime;
                            if (!isPaused) player.play();
                        });
                    }
                },
            };
            
            // ضبط نصوص الواجهة
            player.config.i18n = { ...player.config.i18n, qualityLabel: { 0: 'Auto' } };

        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari Native
            video.src = currentStreamUrl;
        }
    }, [currentStreamUrl, qualities]);

    // مراقبة التغييرات لتشغيل الفيديو
    useEffect(() => {
        if (currentStreamUrl) {
            // تأخير بسيط لضمان تحميل عنصر Plyr
            const timer = setTimeout(initPlayer, 200);
            return () => clearTimeout(timer);
        }
    }, [currentStreamUrl, initPlayer]);

    // تنظيف عند الخروج من الصفحة
    useEffect(() => {
        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, []);


    // ##############################
    //        جلب البيانات
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
        } 
        else if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            const u = window.Telegram.WebApp.initDataUnsafe?.user;
            if (u) setupUser(u);
            else setError("يرجى الفتح من تليجرام.");
        } 

        if (videoId) {
            // استخدام الـ API المحلي الذي يكلم Python
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    
                    // استقبال مصفوفة الجودات من البايثون
                    const availableQualities = data.availableQualities || [];
                    
                    if (availableQualities.length > 0) {
                        setQualities(availableQualities);
                        // نبدأ بأعلى جودة (أول عنصر في المصفوفة)
                        setCurrentStreamUrl(availableQualities[0].url);
                    } else {
                        throw new Error("لا توجد جودات متاحة لهذا الفيديو");
                    }

                    setYoutubeId(data.youtube_video_id);
                    setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);


    // ##############################
    //        تحميل الفيديو
    // ##############################
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
    if (!user || !currentStreamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    // إعدادات Plyr المبدئية
    const plyrSource = {
        type: "video",
        title: videoTitle,
        sources: [
            {
                src: currentStreamUrl,
                type: "application/x-mpegURL",
            }
        ]
    };

    const plyrOptions = {
        controls: [
            "play-large","play","progress","current-time",
            "mute","volume","settings","fullscreen"
        ],
        settings: ["quality", "speed"], // تفعيل قائمة الجودة
        fullscreen: { enabled: true, fallback: true, iosNative: true }
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8"></script>
            </Head>

            <div className="player-wrapper">
                <Plyr 
                    ref={plyrRef}
                    source={plyrSource}
                    options={plyrOptions}
                />
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
                
                .player-wrapper :global(.plyr--video) { height: 100%; }
                .player-wrapper:fullscreen { max-width: none; width: 100%; height: 100%; }
            `}</style>
        </div>
    );
}
