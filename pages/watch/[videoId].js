import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    
    // مراجع (Refs) للتحكم في المشغل والعنصر
    const artRef = useRef(null);
    const playerInstance = useRef(null);
    
    // حالات الواجهة
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // 1. إعداد المستخدم (كودك المعتاد)
    useEffect(() => {
        // ... (نفس كود التحقق من المستخدم السابق)
        // للتبسيط، سنفترض أن المستخدم تم التحقق منه
        setUser({ id: '123', first_name: 'Student' }); 
    }, []);

    // 2. جلب البيانات وتشغيل المشغل
    useEffect(() => {
        if (!videoId) return;

        // تنظيف أي مشغل سابق
        if (playerInstance.current) {
            playerInstance.current.destroy(false);
            playerInstance.current = null;
        }

        setLoading(true);

        fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
            .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
            .then(data => {
                let qualities = data.availableQualities || [];
                if (qualities.length === 0) throw new Error("لا توجد جودات متاحة.");
                
                // ترتيب الجودات: الأعلى أولاً (ليكون هو الافتراضي)
                qualities = qualities.sort((a, b) => b.quality - a.quality);

                // تجهيز القائمة بتنسيق Artplayer الرسمي
                const qualityList = qualities.map((q, index) => ({
                    default: index === 0, // أول واحد هو الافتراضي
                    html: `${q.quality}p`,
                    url: q.url,
                }));

                // بدء تشغيل Artplayer
                initArtPlayer(qualityList, data.videoTitle || "مشاهدة الدرس");
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });

        // تنظيف عند الخروج
        return () => {
            if (playerInstance.current) playerInstance.current.destroy(false);
        };
    }, [videoId]);

    // 3. دالة تهيئة المشغل (المتوافقة مع وثائق المكتبة)
    const initArtPlayer = (qualityList, title) => {
        if (!artRef.current) return;

        const art = new Artplayer({
            container: artRef.current,
            url: qualityList[0].url, // الرابط المبدئي
            quality: qualityList,    // قائمة الجودة (ستظهر زر الإعدادات تلقائياً)
            title: title,
            volume: 0.7,
            isLive: false,
            muted: false,
            autoplay: false,
            autoSize: true,          // ملء الحاوية
            autoMini: true,
            screenshot: true,
            setting: true,           // تفعيل قائمة الإعدادات
            pip: true,
            fullscreen: true,
            fullscreenWeb: true,
            theme: '#23ade5',
            lang: 'ar',

            // إعدادات HLS المخصصة (Custom Type)
            customType: {
                m3u8: function (video, url, art) {
                    // 1. تنظيف HLS القديم عند تغيير الجودة
                    if (art.hls) {
                        art.hls.destroy();
                        art.hls = null;
                    }

                    // 2. إنشاء HLS جديد
                    if (Hls.isSupported()) {
                        const hls = new Hls({
                            maxBufferLength: 30,
                            enableWorker: true,
                            // إعدادات لتجاوز مشاكل الشبكة
                            xhrSetup: function (xhr) { 
                                xhr.withCredentials = false; 
                            }
                        });
                        
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        
                        // حفظ المرجع للوصول إليه لاحقاً
                        art.hls = hls;

                        // معالجة الأخطاء لمنع التعليق
                        hls.on(Hls.Events.ERROR, (event, data) => {
                            if (data.fatal) {
                                switch (data.type) {
                                    case Hls.ErrorTypes.NETWORK_ERROR:
                                        hls.startLoad(); // إعادة المحاولة
                                        break;
                                    case Hls.ErrorTypes.MEDIA_ERROR:
                                        hls.recoverMediaError();
                                        break;
                                    default:
                                        hls.destroy();
                                        break;
                                }
                            }
                        });
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        // دعم Safari
                        video.src = url;
                    } else {
                        art.notice.show = 'Format not supported';
                    }
                },
            },
        });

        // تنظيف HLS عند تدمير المشغل ككل
        art.on('destroy', () => {
            if (art.hls) art.hls.destroy();
        });

        // حفظ المرجع
        playerInstance.current = art;
    };

    if (error) return <div className="center-msg"><h1>{error}</h1></div>;
    
    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            {loading && <div className="loading-overlay">جاري التحميل...</div>}

            <div className="player-wrapper">
                <div ref={artRef} className="artplayer-app"></div>
            </div>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; }
                .page-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 10px; position: relative; }
                .center-msg { display: flex; justify-content: center; align-items: center; height: 100vh; }
                .loading-overlay { position: absolute; z-index: 50; background: rgba(0,0,0,0.8); width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
                .player-wrapper { width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .artplayer-app { width: 100%; height: 100%; }
            `}</style>
        </div>
    );
}
