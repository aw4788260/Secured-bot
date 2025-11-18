import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const artRef = useRef(null);       // مرجع عنصر الـ DIV
    const playerRef = useRef(null);    // مرجع لنسخة المشغل (للتدمير لاحقاً)

    // --- 1. جلب البيانات ---
    useEffect(() => {
        // (نفس كود التحقق من المستخدم السابق...)
        const setupUser = (u) => { if (u && u.id) setUser(u); };
        // ... (اختصاراً للكود المكرر) ...

        if (videoId) {
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    
                    // 1. تجهيز قائمة الجودات بتنسيق Artplayer
                    let qualities = data.availableQualities || [];
                    if (qualities.length === 0) throw new Error("لا توجد جودات.");

                    // ترتيب الجودات (الأعلى أولاً)
                    qualities = qualities.sort((a, b) => b.quality - a.quality);

                    // تحويلها للشكل الذي يفهمه Artplayer
                    const artplayerQualityList = qualities.map((q, index) => ({
                        default: index === 0, // أول واحد هو الافتراضي
                        html: `${q.quality}p`, // النص الذي يظهر في القائمة
                        url: q.url,            // الرابط الخاص بالجودة
                    }));

                    // 2. تشغيل المشغل
                    initArtplayer(artplayerQualityList, data.videoTitle);
                })
                .catch(err => setError(err.message));
        }

        // تنظيف عند الخروج
        return () => {
            if (playerRef.current) {
                playerRef.current.destroy(false);
            }
        };
    }, [videoId]);

    // --- 2. دالة تهيئة المشغل (Official Way) ---
    const initArtplayer = (qualityList, title) => {
        // إذا كان المشغل موجوداً مسبقاً، دمره
        if (playerRef.current) {
            playerRef.current.destroy(false);
        }

        // إنشاء نسخة جديدة
        const art = new Artplayer({
            container: artRef.current, // ربط بالـ DIV
            url: qualityList[0].url,   // الرابط المبدئي
            quality: qualityList,      // قائمة الجودة (ستظهر تلقائياً)
            title: title || "مشاهدة الدرس",
            volume: 0.7,
            isLive: false,
            muted: false,
            autoplay: false,
            autoSize: true,
            autoMini: true,
            screenshot: true,
            setting: true,             // تفعيل زر الإعدادات
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
            theme: '#23ade5',
            lang: 'ar',               // اللغة العربية

            // [هام جداً] دمج HLS.js بالطريقة الرسمية
            customType: {
                m3u8: function (video, url, art) {
                    // تدمير نسخة hls القديمة إذا وجدت (لضمان التبديل النظيف)
                    if (art.hls) art.hls.destroy();

                    if (Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        art.hls = hls; // حفظ المرجع داخل المشغل
                        art.on('destroy', () => hls.destroy());
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    } else {
                        art.notice.show = 'Unsupported playback format: m3u8';
                    }
                },
            },
        });
        
        // حفظ المرجع
        playerRef.current = art;

        // تصحيح بسيط: أحياناً لا تظهر الجودة الافتراضية كـ "مختارة" في القائمة، هذا الكود يضمن ذلك
        art.on('ready', () => {
            console.log("Player is ready");
        });
    };

    if (error) return <div style={{color:'white', textAlign:'center', marginTop:'50px'}}>{error}</div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div className="player-wrapper">
                {/* هذا الـ DIV هو الذي سيتحول لمشغل */}
                <div ref={artRef} className="artplayer-app"></div>
            </div>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; }
                .player-wrapper { width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .artplayer-app { width: 100%; height: 100%; }
            `}</style>
        </div>
    );
}
