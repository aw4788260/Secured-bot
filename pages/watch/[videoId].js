// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

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
            zIndex: 20, pointerEvents: 'none', padding: '4px 8px', 
            background: 'rgba(0, 0, 0, 0.5)', color: 'white', 
            fontSize: 'clamp(12px, 2.5vw, 14px)', borderRadius: '4px',
            fontWeight: 'bold', transition: 'top 2s ease-in-out, left 2s ease-in-out',
            whiteSpace: 'nowrap', textShadow: '1px 1px 2px black'
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
    
    const videoNode = useRef(null);
    const playerRef = useRef(null);

    // 1. تهيئة Video.js
    useEffect(() => {
        // لا نبدأ إلا إذا توفر الرابط وتوفرت المكتبة
        if (!streamUrl || !window.videojs) return;

        // إذا كان المشغل موجوداً بالفعل، قم بتحديث المصدر فقط
        if (playerRef.current) {
            playerRef.current.src({ src: streamUrl, type: 'application/x-mpegURL' });
            return;
        }

        // إعدادات المشغل
        const options = {
            autoplay: false,
            controls: true,
            responsive: true,
            fluid: true,
            sources: [{
                src: streamUrl,
                type: 'application/x-mpegURL'
            }],
            html5: {
                vhs: {
                    overrideNative: true, // إجبار استخدام VHS لضمان عمل اختيار الجودة
                },
                nativeAudioTracks: false,
                nativeVideoTracks: false,
            }
        };

        // إنشاء المشغل
        const player = window.videojs(videoNode.current, options, function onPlayerReady() {
            console.log('Video.js Ready');
            
            // تفعيل إضافة اختيار الجودة (إذا تم تحميلها)
            if (this.hlsQualitySelector) {
                this.hlsQualitySelector({
                    displayCurrentQuality: true,
                });
            } else {
                console.warn("hlsQualitySelector plugin not loaded");
            }
        });

        playerRef.current = player;

        // تنظيف المشغل عند الخروج
        return () => {
            if (player) {
                player.dispose();
                playerRef.current = null;
            }
        };
    }, [streamUrl]); // يعتمد على streamUrl

    // 2. جلب البيانات (نفس المنطق السابق)
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
                .then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.message); }))
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
            catch { alert("خطأ في الاتصال."); }
        } else { alert("متاح فقط في التطبيق."); }
    };

    if (error) return <div className="message-container"><h1>{error}</h1></div>;
    if (!user || !streamUrl) return <div className="message-container"><h1>جاري التحميل...</h1></div>;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                
                {/* 1. ستايل Video.js الأساسي */}
                <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
                
                {/* 2. مكتبة Video.js الأساسية */}
                <script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
                
                {/* 3. إضافات الجودة (Quality Levels + Selector) */}
                <script src="https://unpkg.com/videojs-contrib-quality-levels@2.1.0/dist/videojs-contrib-quality-levels.min.js"></script>
                <script src="https://unpkg.com/videojs-hls-quality-selector@1.1.4/dist/videojs-hls-quality-selector.min.js"></script>
            </Head>

            <div className="player-wrapper">
                <div data-vjs-player>
                    <video 
                        ref={videoNode} 
                        className="video-js vjs-big-play-centered vjs-theme-city" 
                        playsInline
                    />
                </div>
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
                    position: relative; 
                    margin: 0;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    border-radius: 8px;
                    overflow: hidden;
                }

                /* تنسيقات خاصة بـ Video.js لتظهر بشكل جميل */
                .video-js {
                    width: 100%;
                    height: auto;
                    aspect-ratio: 16/9;
                }
                
                /* تحسين شكل قائمة الجودة */
                .vjs-menu-button-popup .vjs-menu {
                    width: 10em;
                    left: -3em;
                }
                .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
                    background-color: rgba(43, 51, 63, 0.9);
                    max-height: 15em;
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
