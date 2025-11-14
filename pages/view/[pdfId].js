// pages/view/[pdfId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (دالة مخصصة لجلب المستخدم والتحقق منه)
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
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


export default function ViewPdfPage() {
    const router = useRouter();
    const { pdfId } = router.query;
    const { user, error } = useUserCheck(router);

    // (حالة لتتبع خطأ تحميل الـ PDF)
    const [pdfError, setPdfError] = useState(false);

    // (منطق العلامة المائية "المكررة")
    const [watermarkSpans, setWatermarkSpans] = useState([]);
    const watermarkText = user ? `${user.first_name} (${user.id})` : '';

    useEffect(() => {
        if (user) {
            setWatermarkSpans(new Array(100).fill(0));
        }
    }, [user]); 

    if (error) { 
        return (
            <div className="message-container">
                <Head><title>خطأ</title></Head>
                <h1>{error}</h1>
            </div>
        ); 
    }
    if (!user || !pdfId) { 
        return (
            <div className="message-container">
                <Head><title>جاري التحميل...</title></Head>
                <h1>جاري التحميل...</h1>
            </div>
        ); 
    }

    const pdfStreamUrl = `/api/secure/get-pdf?lessonId=${pdfId}`;

    return (
        <div className="page-container-pdf">
            <Head><title>عرض الملف</title></Head>

            <div className="pdf-wrapper">
                
                <iframe
                    src={pdfStreamUrl}
                    className="pdf-iframe"
                    title="PDF Viewer"
                    onError={() => { // (هذا سيعمل إذا فشل الـ API)
                        console.error("Iframe onError triggered.");
                        setPdfError(true);
                    }}
                />

                {/* (طبقة العلامة المائية المكررة) */}
                <div className="pdf-watermark-overlay">
                    {watermarkSpans.map((_, index) => (
                        <span key={index} className="watermark-tile">
                            {watermarkText}
                        </span>
                    ))}
                </div>

                {/* (إظهار رسالة الخطأ فوق كل شيء) */}
                {pdfError && (
                    <div className="pdf-load-error">
                        <h1>خطأ في تحميل الملف</h1>
                        <p>لم نتمكن من عرض ملف الـ PDF.</p>
                        <p style={{fontSize: '0.8em', opacity: 0.7}}>(الملف تالف أو تم حذفه)</p>
                    </div>
                )}
            </div>

            <style jsx global>{`
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
                
                .message-container { 
                    display: flex; align-items: center; justify-content: center; 
                    height: 100vh; color: white; padding: 20px; text-align: center; 
                    background: #111827; 
                }
                
                .page-container-pdf {
                    width: 100%;
                    height: 100vh;
                    display: flex;
                    background: #111827; 
                }
                .pdf-wrapper {
                    position: relative; 
                    width: 100%;
                    height: 100%;
                    border: none;
                    background: #333; /* (خلفية رمادية قبل التحميل) */
                }
                .pdf-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    position: absolute;
                    z-index: 1; /* (الطبقة السفلية) */
                }
                
                .pdf-watermark-overlay {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 2; /* (فوق الـ PDF) */
                    pointer-events: none; /* (لتمرير النقرات للـ PDF) */
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                    background: transparent; 
                }
                
                .watermark-tile {
                    padding: 30px 50px; 
                    font-size: 16px;
                    font-weight: bold;
                    color: rgba(128, 128, 128, 0.15); 
                    transform: rotate(-30deg); 
                    white-space: nowrap;
                    user-select: none; /* (لمنع التحديد) */
                }

                .pdf-load-error {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 100; /* (فوق كل شيء) */
                    background: rgba(200, 50, 50, 0.85); /* (أحمر) */
                    color: white;
                    padding: 20px 40px;
                    border-radius: 10px;
                    text-align: center;
                    pointer-events: all; 
                    box-shadow: 0 5px 20px rgba(0,0,0,0.5);
                }
            `}</style>
        </div>
    );
}
