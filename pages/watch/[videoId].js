// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const Plyr = dynamic(() => import('plyr-react'), { ssr: false });
import 'plyr/dist/plyr.css';

// (كومبوننت العلامة المائية)
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
        return () => { if (watermarkIntervalRef.current) clearInterval(watermarkIntervalRef.current); };
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
    
    const [streamUrl, setStreamUrl] = useState(null); 
    const [youtubeId, setYoutubeId] = useState(null); 
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [videoTitle, setVideoTitle] = useState("جاري التحميل...");
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    
    const playerWrapperRef = useRef(null); 
    const plyrInstanceRef = useRef(null); 

    // 1. دالة تهيئة HLS (مع ربط الجودات بـ Plyr)
    const initializeHls = useCallback(() => {
        if (!streamUrl) return;
        if (!plyrInstanceRef.current || !plyrInstanceRef.current.plyr) {
            setTimeout(initializeHls, 200);
            return;
        }

        const videoElement = plyrInstanceRef.current.plyr.media;
        const player = plyrInstanceRef.current.plyr;

        if (window.Hls) {
            if (window.Hls.isSupported()) {
                const hls = new window.Hls({
                    maxBufferLength: 30,
                    maxMaxBufferLength: 600,
                    enableWorker: true
                });
                
                hls.loadSource(streamUrl);
                hls.attachMedia(videoElement);
                
                // [ ✅✅ التعديل الأهم: ربط الجودات ]
                hls.on(window.Hls.Events.MANIFEST_PARSED, function (event, data) {
                    // 1. استخراج الجودات المتاحة
                    const availableQualities = hls.levels.map((l) => l.height);
                    
                    // 2. إضافة خيار "تلقائي" (Auto) في البداية (يمثله الرقم 0)
                    availableQualities.unshift(0);

                    // 3. تحديث إعدادات Plyr
                    player.config.quality = {
                        default: 0, // البدء بـ Auto
                        options: availableQualities,
                        forced: true,
                        onChange: (newQuality) => {
                            // منطق التبديل عند اختيار المستخدم
                            if (newQuality === 0) {
                                hls.currentLevel = -1; // وضع Auto
                            } else {
                                // البحث عن الـ Level Index المناسب للجودة المختارة
                                hls.levels.forEach((level, levelIndex) => {
                                    if (level.height === newQuality) {
                                        hls.currentLevel = levelIndex;
                                    }
                                });
                            }
                        },
                    };
                    
                    // 4. تعيين التسميات (Labels) لتظهر كلمة 'Auto' بدلاً من '0'
                    // (Plyr يضيف 'p' للأرقام تلقائياً، لكن 0 يحتاج تسمية خاصة)
                    player.config.i18n = {
                        ...player.config.i18n,
                        qualityLabel: {
                            0: 'Auto',
                        },
                    };

                    console.log("HLS Qualities loaded:", availableQualities);
                });

                hls.on(window.Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.error("HLS Fatal Error:", data.type);
                        switch (data.type) {
                            case window.Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                            case window.Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                            default: hls.destroy(); break;
                        }
                    }
                });
            } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = streamUrl;
            }
        } else {
            setTimeout(initializeHls, 500);
        }
    }, [streamUrl]);

    useEffect(() => {
        if (streamUrl) initializeHls();
    }, [streamUrl, initializeHls]);

    // (كود جلب البيانات - كما هو)
    useEffect(() => {
        const setupUser = (foundUser) => {
            if (foundUser && foundUser.id) setUser(foundUser);
            else setError("خطأ: لا يمكن التعرف على المستخدم.");
        };

        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        if (urlUserId) {
            setupUser({ id: urlUserId, first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User" });
            if (typeof window.Android !== 'undefined') setIsNativeAndroid(true);
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
             window.Telegram.WebApp.ready();
             const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
             if(miniAppUser) setupUser(miniAppUser);
             else setError("يرجى الفتح من تليجرام.");
        } else {
             setError('يرجى الفتح من التطبيق المخصص.');
        }

        if (videoId) {
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => res.ok ? res.json() : res.json().then(err => { throw new Error(err.message); }))
                .then(data => {
                    if (data.message) throw new Error(data.message);
                    setStreamUrl(data.streamUrl);
                    setYoutubeId(data.youtube_video_id);
                    setVideoTitle(data.videoTitle || "مشاهدة الدرس");
                })
                .catch(err => setError(err.message));
        }
    }, [videoId]);

    const handleDownloadClick = () => {
        if (!youtubeId) return alert("انتظر..");
        if (isNativeAndroid) {
            try { window.Android.downloadVideo(youtubeId, videoTitle); } 
            catch (e) { alert("خطأ في الاتصال."); }
        } else { alert("متاح فقط في التطبيق."); }
    };

    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    // إعدادات Plyr الأولية
    const plyrSource = {
        type: 'video',
        title: videoTitle,
        sources: [
            { src: streamUrl, type: 'application/x-mpegURL' }
        ]
    };
    
    const plyrOptions = {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen', 'settings'],
        settings: ['quality', 'speed'], // تأكدنا من وجود quality هنا
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
                    ref={plyrInstanceRef} 
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

            {/* [ ✅ تعديل CSS ] تم نقل الفوتر ليكون Absolute في الأسفل لضمان توسط الفيديو */}
            <footer className="developer-info">
              <p>برمجة وتطوير: A7MeD WaLiD</p>
              <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>

            <style jsx global>{`
                body { margin: 0; background: #111; color: white; font-family: sans-serif; overscroll-behavior: contain; }
                
                /* [ ✅ تعديل ] تنسيق الحاوية لتوسيط المحتوى */
                .page-container { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; /* توسيط عمودي */
                    min-height: 100vh; 
                    padding: 10px; 
                    position: relative; /* عشان الفوتر يبقى absolute بالنسبة ليها */
                }
                
                .message-container { display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
                
                .player-wrapper { 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: 16/9; 
                    background: #000; 
                    position: relative; 
                    /* [ ✅ تعديل ] إزالة الهوامش الكبيرة التي قد تزيح التوسيط */
                    margin: 0; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    border-radius: 8px;
                    overflow: hidden;
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
                    margin-top: 20px; /* مسافة بين الفيديو والزر */
                }

                /* [ ✅ تعديل ] تثبيت الفوتر في الأسفل */
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
