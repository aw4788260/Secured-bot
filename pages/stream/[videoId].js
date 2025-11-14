// pages/stream/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (دالة مخصصة لجلب المستخدم والتحقق منه)
// (هذه مأخوذة ومعدلة من ملف watch/[videoId].js)
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!router.isReady) return; // (انتظر حتى تصبح query جاهزة)

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

            // [ ✅ تعديل: السماح لـ (iOS, macOS, tdesktop) مباشرة ]
            if (platform === 'ios' || platform === 'macos' || platform === 'tdesktop') {
                setUser(miniAppUser);
            } else {
                // [ الحالة 2ب: المنصات الأخرى (مثل android, web) يجب التحقق من الأدمن ]
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
    }, [router.isReady, router.query]); // (يعتمد على router.isReady)

    return { user, error };
};

export default function StreamPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const { user, error } = useUserCheck(router);

    // --- [ تطبيق العلامة المائية المتحركة (كما هي في يوتيوب) ] ---
    const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });
    const [stickerPos, setStickerPos] = useState({ top: '50%', left: '50%' });
    const watermarkIntervalRef = useRef(null);
    const stickerIntervalRef = useRef(null);

    useEffect(() => {
        if (!user) return; 

        // (نفس كود الحركة العشوائية)
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
        }, 3000); // (الملصق يتحرك أسرع)

        return () => {
            clearInterval(watermarkIntervalRef.current);
            clearInterval(stickerIntervalRef.current);
        };
    }, [user]);
    // --- [ نهاية كود العلامة المائية المتحركة ] ---

    if (error) { 
        return (
            <div className="page-container">
                <Head><title>خطأ</title></Head>
                <h1>{error}</h1>
            </div>
        ); 
    }
    
    // (إظهار شاشة تحميل حتى يتم جلب المستخدم والفيديو ID)
    if (!user || !videoId) { 
        return (
             <div className="page-container">
                <Head><title>جاري التحميل</title></Head>
                <h1>جاري تحميل الفيديو...</h1>
            </div>
        );
    }

    const videoStreamUrl = `/api/secure/get-video-stream?lessonId=${videoId}`;

    return (
        <div className="page-container">
            <Head>
                <title>مشاهدة الدرس</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
            </Head>

            <div className="player-wrapper-html5">
                <video
                    src={videoStreamUrl}
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    className="html5-video-player"
                    preload="metadata"
                />

                {/* (طبقة العلامة المائية) */}
                <div className="watermark-overlay">
                    <div className="watermark" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                        {user.first_name} ({user.id})
                    </div>
                    <div 
                        className="sticker-watermark" 
                        style={{ top: stickerPos.top, left: stickerPos.left }}
                    >
                       {/* (هذا div للملصق) */}
                    </div>
                </div>
            </div>
            
            {/* --- [ ✅✅ بداية: إضافة الفوتر هنا ] --- */}
            <footer className="developer-info" style={{ maxWidth: '900px', margin: '30px auto 0' }}>
              <p>برمجة وتطوير: A7MeD WaLiD</p>
              <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
            </footer>
            {/* --- [ نهاية: إضافة الفوتر ] --- */}
            
            <style jsx global>{`
                body { 
                    margin: 0; 
                    overscroll-behavior: contain; 
                    /* (الخلفية ستكون من globals.css) */
                }
                
                /* (كود التوسيط - سيقوم بتوسيط المشغل والفوتر كمجموعة) */
                .page-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;     /* (توسيط أفقي) */
                    justify-content: center; /* (توسيط رأسي) */
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
                    aspect-ratio: 16 / 9;
                    background: #111;
                    border-radius: 8px; /* (شكل جمالي) */
                    overflow: hidden; /* (لقص الزوايا) */
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
                    background-image: url('/logo-sticker.png'); /* (مسار افتراضي للملصق) */
                    background-size: contain;
                    background-repeat: no-repeat;
                    opacity: 0.6;
                    transition: top 1.5s ease-in-out, left 1.5s ease-in-out;
                    z-index: 21;
                }
                
                /* (لا نحتاج لإضافة ستايل .developer-info هنا)
                  (لأنه موجود بالفعل في styles/globals.css)
                */
            `}</style>
        </div>
    );
}
