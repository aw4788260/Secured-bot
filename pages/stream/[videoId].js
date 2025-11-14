// pages/stream/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (دالة مخصصة لجلب المستخدم والتحقق منه)
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!router.isReady) return; 

        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        // [ الحالة 1: مستخدم البرنامج (APK) ]
        if (urlUserId && urlUserId.trim() !== '') {
            const apkUser = { 
                id: urlUserId, 
                first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User"
            };
            setUser(apkUser);

        // [ الحالة 2: مستخدم تليجرام ميني آب ]
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
        // [ الحالة 3: مستخدم متصفح عادي (منع الدخول) ]
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
        watermarkIntervalRef.current = setInterval(() => {
            setWatermarkPos({ 
                top: `${Math.floor(Math.random() * 70) + 10}%`, 
                left: `${Math.floor(Math.random() * 70) + 10}%` 
            });
        }, 5000);
        stickerIntervalRef.current = setInterval(() => {
            setStickerPos({ 
                top: `${Math.floor(Math.random() * 60) + 20}%`, 
                left: `${Math.floor(Math.random() * 60) + 20}%` 
            });
        }, 3000); 

        return () => {
            clearInterval(watermarkIntervalRef.current);
            clearInterval(stickerIntervalRef.current);
        };
    }, [user]);
    // --- [ نهاية كود العلامة المائية ] ---
    
    // (للتأكد من أننا نستخدم الحاوية الصحيحة)
    const playerWrapperRef = useRef(null); 

    // (دالة ملء الشاشة)
    const handleFullscreen = () => {
        const elem = playerWrapperRef.current; // (استهداف الحاوية)
        if (!elem) return;
        
        const requestFS = elem.requestFullscreen || elem.mozRequestFullScreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
        const exitFS = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
        
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (requestFS) {
                requestFS.call(elem); 
            }
        } else {
            if (exitFS) {
                exitFS.call(document);
            }
        }
    };


    if (error) { 
        return <div className="page-container">...</div>; 
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

            {/* (إضافة ref هنا) */}
            <div className="player-wrapper-html5" ref={playerWrapperRef}> 
                <video
                    src={videoStreamUrl}
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    className="html5-video-player"
                    preload="metadata"
                />
                <div className="watermark-overlay">
                    <div className="watermark" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                        {user.first_name} ({user.id})
                    </div>
                    <div 
                        className="sticker-watermark" 
                        style={{ top: stickerPos.top, left: stickerPos.left }}
                    >
                    </div>
                </div>
                {/* (زر ملء الشاشة المخصص - إذا أردت استخدامه بدلاً من زر المتصفح) */}
                {/* <button onClick={handleFullscreen} style={{position: 'absolute', bottom: '10px', right: '10px', zIndex: 99}}>FS</button> */}
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
                    /* (هذا هو السطر المسبب للمشكلة) */
                    aspect-ratio: 16 / 9; 
                    background: #111;
                    border-radius: 8px; 
                    overflow: hidden; 
                }
                
                /* --- [ ✅✅ بداية: هذا هو الإصلاح ] --- */
                /* (عندما تكون الحاوية في وضع ملء الشاشة) */
                .player-wrapper-html5:fullscreen {
                    aspect-ratio: auto; /* (1. الغي تثبيت النسبة) */
                    max-width: none;    /* (2. اسمح لها بملء الشاشة) */
                }
                .player-wrapper-html5:-webkit-full-screen {
                    aspect-ratio: auto;
                    max-width: none;
                }
                .player-wrapper-html5:-moz-full-screen {
                    aspect-ratio: auto;
                    max-width: none;
                }
                .player-wrapper-html5:-ms-fullscreen {
                    aspect-ratio: auto;
                    max-width: none;
                }
                /* --- [ نهاية: الإصلاح ] --- */


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

                .watermark {
                    position: absolute; 
                    padding: 4px 8px; 
                    background: rgba(0, 0, 0, 0.7); 
                    color: white; 
                    font-size: clamp(10px, 2.5vw, 14px);
                    border-radius: 4px;
                    transition: top 2s ease-in-out, left 2s ease-in-out;
                    z-index: 20;
                    white-space: nowrap;
                }
                .sticker-watermark {
                    position: absolute;
                    width: 80px; height: 80px;
                    background-image: url('/logo-sticker.png'); 
                    background-size: contain;
                    background-repeat: no-repeat;
                    opacity: 0.6;
                    transition: top 1.5s ease-in-out, left 1.5s ease-in-out;
                    z-index: 21;
                }
            `}</style>
        </div>
    );
}
