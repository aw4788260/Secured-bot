import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// استدعاء Plyr بدون SSR لتجنب مشاكل التوافق
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// --- مكون العلامة المائية ---
const Watermark = ({ user }) => {
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setWatermarkPos({ 
                top: `${Math.floor(Math.random() * 80) + 10}%`, 
                left: `${Math.floor(Math.random() * 80) + 10}%` 
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div className="watermark" style={{ 
            position: 'absolute', top: watermarkPos.top, left: watermarkPos.left,
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
    
    // --- States ---
    // نخزن كل بيانات الفيديو (بما فيها الجودات) في كائن واحد
    const [videoData, setVideoData] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const plyrRef = useRef(null);
    const hlsRef = useRef(null);

    // 1. جلب البيانات (لن يتم عرض المشغل حتى تنجح هذه الخطوة)
    useEffect(() => {
        const setupUser = (u) => { if (u && u.id) setUser(u); else setError("خطأ: لا يمكن التعرف على المستخدم."); };
        
        // التحقق من المستخدم (Telegram / URL)
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
                    const qualities = data.availableQualities || [];
                    if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                    
                    // حفظ البيانات (هذا سيسمح للمشغل بالظهور الآن)
                    setVideoData({
                        title: data.videoTitle || "مشاهدة الدرس",
                        qualities: qualities, // المصفوفة القادمة من البايثون
                        youtubeId: data.youtube_video_id,
                        currentUrl: qualities[0].url // نبدأ بأعلى جودة افتراضياً
                    });
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);

    // 2. تهيئة HLS (يعمل فقط بعد ظهور المشغل)
    useEffect(() => {
        if (!videoData) return; // لا تفعل شيئاً حتى تجهز البيانات

        const initHls = () => {
            const video = plyrRef.current?.plyr?.media;
            if (!video) return;

            if (window.Hls && window.Hls.isSupported()) {
                if (hlsRef.current) hlsRef.current.destroy();

                const hls = new window.Hls({
                    maxBufferLength: 30,
                    enableWorker: true,
                    xhrSetup: function (xhr) { xhr.withCredentials = false; }
                });

                hls.loadSource(videoData.currentUrl);
                hls.attachMedia(video);
                hlsRef.current = hls;

            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = videoData.currentUrl;
            }
        };

        // تأخير بسيط لضمان وجود عنصر الفيديو في DOM
        const timer = setTimeout(initHls, 100);
        return () => {
            clearTimeout(timer);
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [videoData]); // يعيد التشغيل فقط إذا تم تحميل بيانات الفيديو لأول مرة

    // 3. إعداد خيارات Plyr (يتم حسابها قبل الريندر)
    // هذا هو الجزء المسؤول عن ظهور زر الجودة
    const plyrOptions = useMemo(() => {
        if (!videoData) return null;

        // استخراج قائمة الأرقام للجودة (مثلاً: [1080, 720, 360])
        const qualityOptions = videoData.qualities.map(q => q.quality);

        return {
            controls: [
                "play-large", "play", "progress", "current-time",
                "mute", "volume", "settings", "fullscreen"
            ],
            settings: ["quality", "speed"],
            quality: {
                default: qualityOptions[0], // افتراضياً أعلى جودة
                options: qualityOptions,
                forced: true,
                onChange: (newQuality) => {
                    // عند تغيير الجودة، نبحث عن الرابط المقابل
                    const selected = videoData.qualities.find(q => q.quality === newQuality);
                    if (selected && hlsRef.current) {
                        console.log(`Switching quality to: ${newQuality}p`);
                        
                        // نحفظ الوقت الحالي
                        const player = plyrRef.current?.plyr;
                        const currentTime = player?.currentTime || 0;
                        const isPaused = player?.paused;

                        // نحمل الرابط الجديد
                        hlsRef.current.loadSource(selected.url);
                        
                        // نستعيد الوقت
                        hlsRef.current.once(window.Hls.Events.MANIFEST_PARSED, () => {
                            if (player) {
                                player.currentTime = currentTime;
                                if (!isPaused) player.play();
                            }
                        });
                    }
                },
            },
            i18n: { qualityLabel: { 0: 'Auto' } }
        };
    }, [videoData]);

    // --- الريندر ---
    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    
    // [هام] هنا السر: لا نعرض المشغل إلا إذا كانت plyrOptions جاهزة
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
                        // نضع الرابط المبدئي هنا، لكن HLS سيقوم بالعمل الفعلي
                        sources: [{ src: videoData.currentUrl, type: "application/x-mpegURL" }]
                    }}
                    options={plyrOptions} // الخيارات هنا تحتوي على الجودات بالفعل
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
