// pages/watch/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import YouTube from 'react-youtube';

export default function WatchPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const [youtubeId, setYoutubeId] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    
    const playerRef = useRef(null);
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const watermarkIntervalRef = useRef(null);

    // [الكود الذي أضفناه سابقاً لتحديد الهوية - كما هو]
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');
        let tgUser = null;
        if (urlUserId && urlUserId.trim() !== '') {
            tgUser = { 
                id: urlUserId, 
                first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User"
            };
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        }
        if (tgUser && tgUser.id) { 
            setUser(tgUser); 
        } else { 
            setError("خطأ: لا يمكن التعرف على المستخدم."); 
            return; 
        }
        if (videoId) {
            fetch(`/api/secure/get-video-id?lessonId=${videoId}`)
                .then(res => { if (!res.ok) throw new Error('لا تملك صلاحية مشاهدة هذا الفيديو'); return res.json(); })
                .then(data => setYoutubeId(data.youtube_video_id))
                .catch(err => setError(err.message));
        }
        
        // الإبقاء على interval العلامة المائية
        watermarkIntervalRef.current = setInterval(() => {
            const newTop = Math.floor(Math.random() * 70) + 10;
            const newLeft = Math.floor(Math.random() * 70) + 10;
            setWatermarkPos({ top: `${newTop}%`, left: `${newLeft}%` });
        }, 5000);

        return () => { 
            clearInterval(watermarkIntervalRef.current); 
        };
    }, [videoId]); 

    // [دالة onReady كما هي]
    const onPlayerReady = useCallback((event) => { 
        playerRef.current = event.target; 
    }, []);

    // --- [ ✅ تم حذف دالة handleSeek وكل ما يتعلق بها ] ---

    if (error) { return <div className="message-container"><Head><title>خطأ</title></Head><h1>{error}</h1></div>; }
    if (!youtubeId || !user) { return <div className="message-container"><Head><title>جاري التحميل</title></Head><h1>جاري تحميل الفيديو...</h1></div>; }
    
    // [إظهار أزرار التحكم الأصلية كما هي]
    const opts = { 
        playerVars: { 
            autoplay: 0, 
            controls: 1, 
            rel: 0, 
            showinfo: 0, 
            modestbranding: 1, 
            disablekb: 1, 
        }, 
    };

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div className="player-wrapper">
                <YouTube
                    videoId={youtubeId}
                    opts={opts}
                    className="youtube-player"
                    iframeClassName="youtube-iframe"
                    onReady={onPlayerReady}
                />

                {/* --- [ ✅ تم تبسيط الطبقة العلوية ] --- */}
                {/* هذه الطبقة الآن تحتوي فقط على العلامة المائية 
                   وهي لا تعترض أي أحداث لمس (pointer-events: none) */}
                <div className="watermark-overlay">
                    <div className="watermark" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                        {user.first_name} ({user.id})
                    </div>
                </div>
            </div>

            {/* --- [ ✅ CSS المعدل والنهائي ] --- */}
            <style jsx global>{`
                body { margin: 0; overscroll-behavior: contain; }
                .page-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; width: 100%; padding: 10px; box-sizing: border-box; }
                .message-container { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; padding: 20px; text-align: center; }
                
                .player-wrapper { 
                    position: relative; 
                    width: 100%; 
                    max-width: 900px; 
                    aspect-ratio: 16 / 9;
                    background: #111; 
                }
                .youtube-player, .youtube-iframe { width: 100%; height: 100%; }

                /* (طبقة العلامة المائية فقط) */
                .watermark-overlay { 
                    position: absolute; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    z-index: 10; 
                    pointer-events: none; /* <-- أهم سطر: يجعل الطبقة شفافة تماماً للضغط */
                }
                
                /* (العلامة المائية كما هي) */
                .watermark { 
                    position: absolute; 
                    padding: 4px 8px; 
                    background: rgba(0, 0, 0, 0.7); 
                    color: white; 
                    font-size: clamp(10px, 2.5vw, 14px); 
                    border-radius: 4px; 
                    font-weight: bold; 
                    pointer-events: none; 
                    transition: top 2s ease-in-out, left 2s ease-in-out; 
                    white-space: nowrap; 
                    z-index: 20; 
                }
                
                /* --- (تم حذف كل ما يتعلق بـ seek-zone و interaction-grid و seek-indicator) --- */
            `}</style>
        </div>
    );
}
