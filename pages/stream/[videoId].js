// pages/stream/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (دالة مخصصة لجلب المستخدم والتحقق منه - كما هي)
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!router.isReady) return; 

        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        if (urlUserId && urlUserId.trim() !== '') {
            const apkUser = { 
                id: urlUserId, 
                first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User"
            };
            setUser(apkUser);
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            const platform = window.Telegram.WebApp.platform;
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;

            if (!miniAppUser || !miniAppUser.id) {
                setError("لا يمكن التعرف على هويتك من تليجرام.");
                return;
            }

            if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
                setUser(miniAppUser);
            } else {
                fetch(`/api/auth/check-admin?userId=${miniAppUser.id}`)
                    .then(res => res.json())
                    .then(adminData => {
                        if (adminData.isAdmin) {
                            setUser(miniAppUser);
                        } else {
                            setError('عذراً، الفتح متاح للآيفون، الماك، والويندوز. مستخدمو الأندرويد يجب عليهم استخدام البرنامج المخصص.');
                        }
                    })
                    .catch(err => {
                        setError('حدث خطأ أثناء التحقق من صلاحيات الأدمن.');
                    });
            }
        } else {
             setError('الرجاء الفتح من البرنامج المخصص (للأندرويد) أو من تليجرام.');
             return;
        }
    }, [router.isReady, router.query]); 

    return { user, error };
};

export default function StreamPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const { user, error } = useUserCheck(router);

    // --- [ كود العلامة المائية (كما هو) ] ---
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const [stickerPos, setStickerPos] = useState({ top: '50%', left: '50%' });
    const watermarkIntervalRef = useRef(null);
    const stickerIntervalRef = useRef(null);

    useEffect(() => {
        if (!user) return; 
        watermarkIntervalRef.current = setInterval(() => { /* ... */ }, 5000);
        stickerIntervalRef.current = setInterval(() => { /* ... */ }, 3000); 
        return () => {
            clearInterval(watermarkIntervalRef.current);
            clearInterval(stickerIntervalRef.current);
        };
    }, [user]);
    // --- [ نهاية كود العلامة المائية ] ---
    
    // --- [ ✅✅ بداية: الكود الجديد ] ---
    // (Ref للحاوية الرئيسية)
    const playerWrapperRef = useRef(null); 
    // (State لتخزين النسبة)
    const [aspectRatio, setAspectRatio] = useState('16 / 9'); // (الافتراضي)

    // (دالة ملء الشاشة المخصصة التي تستهدف الحاوية)
    const handleFullscreen = () => {
        const elem = playerWrapperRef.current; 
        if (!elem) return;
        
        const requestFS = elem.requestFullscreen || elem.mozRequestFullScreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
        const exitFS = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
        
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (requestFS) requestFS.call(elem); 
        } else {
            if (exitFS) exitFS.call(document);
        }
    };

    // (دالة لاكتشاف أبعاد الفيديو عند تحميله)
    const handleMetadata = (e) => {
        const { videoWidth, videoHeight } = e.target;
        if (videoHeight > videoWidth) {
            // (هذا فيديو طويل)
            setAspectRatio('7 / 16');
        } else {
            // (هذا فيديو عريض)
            setAspectRatio('16 / 9');
        }
    };
    // --- [ نهاية: الكود الجديد ] ---


    if (error) { 
        return <div className="page-container"><h1>{error}</h1></div>; 
    }
    if (!user || !videoId) { 
        return <div className="page-container"><h1>جاري تحميل الفيديو...</h1></div>;
    }

    const videoStreamUrl = `/api/secure/get-video-stream?lessonId=${videoId}`;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            {/* (تطبيق الـ ref والـ style الديناميكي) */}
            <div 
                className="player-wrapper-html5" 
                ref={playerWrapperRef}
                style={{ aspectRatio: aspectRatio }} // (تطبيق النسبة 16/9 أو 7/16)
            > 
                <video
                    src={videoStreamUrl}
                    controls
                    // --- [ ✅✅ تعديل: إخفاء زر ملء الشاشة الأصلي ] ---
                    controlsList="nodownload nofullscreen" 
                    disablePictureInPicture
                    className="html5-video-player"
                    preload="metadata"
                    // --- [ ✅✅ تعديل: إضافة مستمع التحميل ] ---
                    onLoadedMetadata={handleMetadata}
                />
                <div className="watermark-overlay">
                    {/* ... (العلامات المائية كما هي) ... */}
                </div>
                
                {/* --- [ ✅✅ جديد: إضافة الزر المخصص ] --- */}
                <button 
                    className="custom-fullscreen-btn" 
                    onClick={handleFullscreen}
                    title="ملء الشاشة"
                >
                    ⛶
                </button>
            </div>
            
            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
              <p>برمجة وتطوير: A7MeD WaLiD</p>
              <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>
            
            <style jsx global>{`
                body { 
                    margin: 0; 
                    overscroll-behavior: contain; 
                }
                
                .page-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;     
                    justify-content: center; 
                    min-height: 100vh;
                    width: 100%;
                    padding: 10px;
                    box-sizing: border-box;
                    color: white;
                    text-align: center;
                }

                .player-wrapper-html5 {
                    position: relative; 
                    width: 100%;
                    max-width: 900px;
                    /* (تم حذف aspect-ratio الثابت من هنا) */
                    /* (سيتم تطبيقه الآن عن طريق inline style) */
                    background: #111;
                    border-radius: 8px; 
                    overflow: hidden; 
                    /* (إضافة حركة ناعمة عند تغيير النسبة) */
                    transition: aspect-ratio 0.3s ease;
                }
                
                /* (هذا هو الإصلاح الذي يحل مشكلة التعارض) */
                .player-wrapper-html5:fullscreen,
                .player-wrapper-html5:-webkit-full-screen,
                .player-wrapper-html5:-moz-full-screen,
                .player-wrapper-html5:-ms-fullscreen {
                    aspect-ratio: auto !important; /* (الغاء النسبة تماماً في ملء الشاشة) */
                    max-width: none;
                }


                .html5-video-player { 
                    width: 100%; 
                    height: 100%; 
                    border: none;
                }
                
                .watermark-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none;
                    z-index: 10;
                    overflow: hidden; 
                }
                
                /* ... (ستايل .watermark و .sticker-watermark كما هو) ... */
                .watermark { /* ... */ }
                .sticker-watermark { /* ... */ }

                /* --- [ ✅✅ جديد: ستايل الزر المخصص ] --- */
                .custom-fullscreen-btn {
                    position: absolute;
                    bottom: 12px; /* (تعديل المسافة لتناسب شريط التحكم) */
                    right: 15px;
                    z-index: 21; /* (فوق الفيديو) */
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    padding: 5px 8px;
                    line-height: 1;
                    opacity: 0.7;
                    transition: opacity 0.2s ease;
                }
                .player-wrapper-html5:hover .custom-fullscreen-btn {
                    opacity: 1;
                }
                .custom-fullscreen-btn:hover {
                    background: rgba(0,0,0,0.8);
                }
            `}</style>
        </div>
    );
}
