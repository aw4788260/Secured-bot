// pages/stream/[videoId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (انسخ دالة useUserCheck بالكامل من ملف watch/[videoId].js)
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // ... (نفس كود التحقق من المستخدم من ملف watch.js)
        // (يتضمن التحقق من APK, Telegram, Admin, etc.)
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');

        if (urlUserId && urlUserId.trim() !== '') {
            setUser({ id: urlUserId, first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User" });
        } else if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
             window.Telegram.WebApp.ready();
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (miniAppUser) setUser(miniAppUser);
            else setError("لا يمكن التعرف على هويتك.");
        } else {
            setError('الوصول غير مصرح به.');
        }
    }, [router.query]);

    return { user, error };
};

export default function StreamPage() {
    const router = useRouter();
    const { videoId } = router.query;
    const { user, error } = useUserCheck(router);

    // --- [ ✅✅ تطبيق العلامة المائية المتحركة (كما هي في يوتيوب) ] ---
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

    if (error) { return <div className="message-container"><h1>{error}</h1></div>; }
    if (!user || !videoId) { return <div className="message-container"><h1>جاري التحميل...</h1></div>; }

    const videoStreamUrl = `/api/secure/get-video-stream?lessonId=${videoId}`;

    return (
        <div className="page-container">
            <Head><title>مشاهدة الدرس</title></Head>

            <div className="player-wrapper-html5">
                <video
                    src={videoStreamUrl}
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    className="html5-video-player"
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
            
            <footer className="developer-info">...</footer>

            <style jsx global>{`
                /* ... (انسخ ستايلات .page-container و .message-container) ... */
                
                .player-wrapper-html5 {
                    position: relative; 
                    width: 100%;
                    max-width: 900px;
                    aspect-ratio: 16 / 9;
                    background: #111;
                }
                .html5-video-player { width: 100%; height: 100%; }
                
                .watermark-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none;
                    z-index: 10;
                    overflow: hidden; 
                }

                /* (انسخ ستايلات .watermark و .sticker-watermark من ملف watch.js) */
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
                    opacity: 0.6;
                    transition: top 1.5s ease-in-out, left 1.5s ease-in-out;
                    z-index: 21;
                }
            `}</style>
        </div>
    );
}
