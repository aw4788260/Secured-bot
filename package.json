import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

const Watermark = ({ user }) => {
    const [pos, setPos] = useState({ top: '10%', left: '10%' });
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setPos({ 
                top: `${Math.floor(Math.random() * 80) + 10}%`, 
                left: `${Math.floor(Math.random() * 80) + 10}%` 
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div style={{ 
            position: 'absolute', top: pos.top, left: pos.left,
            zIndex: 20, pointerEvents: 'none', padding: '4px 8px', 
            background: 'rgba(0, 0, 0, 0.6)', color: 'white', 
            fontSize: 'clamp(10px, 2.5vw, 14px)', borderRadius: '4px',
            fontWeight: 'bold', transition: 'all 2s ease', whiteSpace: 'nowrap'
        }}>
            {user.first_name} ({user.id})
        </div>
    );
};

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    // States
    const [videoData, setVideoData] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const plyrRef = useRef(null);
    const hlsRef = useRef(null);

    // دالة إنشاء وتشغيل HLS برابط محدد
    const createHlsInstance = (url, videoElement) => {
        // 1. تدمير النسخة القديمة لضمان التبديل النظيف
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
                maxBufferLength: 30,
                enableWorker: true,
                xhrSetup: function (xhr) { xhr.withCredentials = false; }
            });

            console.log("🔌 Loading Stream:", url);
            hls.loadSource(url);
            hls.attachMedia(videoElement);
            
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                 // يمكن هنا إضافة منطق التشغيل التلقائي لو أردت
            });
            
            hlsRef.current = hls;
        } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
            videoElement.src = url;
        }
    };

    // 1. جلب البيانات وتجهيزها
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

        if (videoId) {
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
                .then(data => {
                    let qualities = data.availableQualities || [];
                    if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                    
                    // [هام] ترتيب الجودات تنازلياً (الأعلى أولاً) ليتم اختيارها كافتراضي
                    qualities = qualities.sort((a, b) => b.quality - a.quality);

                    setVideoData({
                        title: data.videoTitle || "مشاهدة الدرس",
                        qualities: qualities,
                        youtubeId: data.youtube_video_id,
                        currentUrl: qualities[0].url // نبدأ بأعلى جودة
                    });
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);

    // 2. تهيئة المشغل لأول مرة
    useEffect(() => {
        if (!videoData) return;

        // ننتظر قليلاً حتى يتم رسم عنصر الفيديو في الـ DOM
        const timer = setTimeout(() => {
            const video = plyrRef.current?.plyr?.media;
            if (video) {
                createHlsInstance(videoData.currentUrl, video);
            }
        }, 200);

        return () => {
            clearTimeout(timer);
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [videoData]);

    // 3. إعداد خيارات Plyr (بما فيها منطق تغيير الجودة الصارم)
    const plyrOptions = useMemo(() => {
        if (!videoData) return null;

        const qualityOptions = videoData.qualities.map(q => q.quality); // [1080, 720, 360...]

        return {
            controls: [
                "play-large", "play", "progress", "current-time",
                "mute", "volume", "settings", "fullscreen"
            ],
            settings: ["quality", "speed"],
            quality: {
                default: qualityOptions[0], // اختيار أعلى جودة كافتراضي
                options: qualityOptions,
                forced: true,
                onChange: (newQuality) => {
                    console.log(`🎚 Switching Request to: ${newQuality}p`);
                    
                    // البحث عن الرابط الجديد
                    const selectedStream = videoData.qualities.find(q => q.quality === newQuality);
                    const video = plyrRef.current?.plyr?.media;
                    const player = plyrRef.current?.plyr;
                    
                    if (selectedStream && video && player) {
                        // 1. حفظ التوقيت وحالة التشغيل
                        const currentTime = player.currentTime;
                        const isPaused = player.paused;

                        // 2. [Hard Switch] إعادة إنشاء HLS بالرابط الجديد
                        createHlsInstance(selectedStream.url, video);

                        // 3. استعادة التوقيت عند جاهزية الرابط الجديد
                        // نستخدم مستمع حدث لمرة واحدة (once)
                        const onParsed = () => {
                            player.currentTime = currentTime;
                            if (!isPaused) {
                                const playPromise = player.play();
                                if (playPromise) playPromise.catch(() => {});
                            }
                            // إزالة المستمع للتنظيف (hls.once تقوم بذلك تلقائياً لكن للتأكيد)
                        };

                        if (hlsRef.current) {
                            hlsRef.current.once(window.Hls.Events.MANIFEST_PARSED, onParsed);
                        }
                    }
                },
            },
            i18n: { qualityLabel: { 0: 'Auto' } }
        };
    }, [videoData]); // يعاد الحساب فقط عند تحميل البيانات لأول مرة

    // --- الريندر ---
    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    
    // لا نظهر المشغل إلا عندما تكون الخيارات جاهزة تماماً
    if (!videoData || !plyrOptions) return <div className="message-container"><h1>جاري تجهيز المشغل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>{videoData.title}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
            </Head>

            <div className="player-wrapper">
                <Plyr 
                    ref={plyrRef}
                    source={{
                        type: "video",
                        title: videoData.title,
                        // نمرر المصادر كـ mpegURL ليقبلها Plyr، لكن HLS هو من سيقوم بالعمل
                        sources: [{ src: videoData.currentUrl, type: "application/x-mpegURL" }]
                    }}
                    options={plyrOptions}
                />
                <Watermark user={user} />
            </div>

            {isNativeAndroid && videoData.youtubeId && (
                <button onClick={() => {
                    try { window.Android.downloadVideo(videoData.youtubeId, videoData.title); } 
                    catch { alert("خطأ في الاتصال."); }
                }} className="download-button-native">
                    ⬇️ تحميل الفيديو (أوفلاين)
                </button>
            )}

            <footer className="developer-info">
                <p>برمجة وتطوير: A7MeD WaLiD</p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; position: relative; }
                .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; }
                .player-wrapper { width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .download-button-native { width: 100%; max-width: 900px; padding: 15px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #111; margin-top: 20px; }
                .developer-info { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.85rem; color: #777; }
                .player-wrapper :global(.plyr--video) { height: 100%; }
            `}</style>
        </div>
    );
}
