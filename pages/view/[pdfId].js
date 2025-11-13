// pages/view/[pdfId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

// (انسخ دالة useUserCheck بالكامل من ملف watch/[videoId].js)
const useUserCheck = (router) => {
    // ... (نفس كود التحقق من المستخدم)
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

    // --- [ ✅✅ بداية: منطق العلامة المائية "المكررة" ] ---
    // (سنقوم بإنشاء مصفوفة من العناصر لتكرارها على الشاشة)
    const [watermarkSpans, setWatermarkSpans] = useState([]);
    const watermarkText = user ? `${user.first_name} (${user.id})` : '';

    useEffect(() => {
        if (user) {
            // (أنشئ 100 عنصر "وهمي" ليتم تكرارهم)
            setWatermarkSpans(new Array(100).fill(0));
        }
    }, [user]); // (يعتمد على المستخدم)
    // --- [ نهاية المنطق ] ---


    if (error) { return <div className="message-container"><h1>{error}</h1></div>; }
    if (!user || !pdfId) { return <div className="message-container"><h1>جاري التحميل...</h1></div>; }

    const pdfStreamUrl = `/api/secure/get-pdf?lessonId=${pdfId}`;

    return (
        <div className="page-container-pdf">
            <Head><title>عرض الملف</title></Head>

            <div className="pdf-wrapper">
                {/* (الـ PDF سيُعرض في الخلفية) */}
                <iframe
                    src={pdfStreamUrl}
                    className="pdf-iframe"
                    title="PDF Viewer"
                />

                {/* (طبقة العلامة المائية المكررة) */}
                <div className="pdf-watermark-overlay">
                    {watermarkSpans.map((_, index) => (
                        <span key={index} className="watermark-tile">
                            {watermarkText}
                        </span>
                    ))}
                </div>
            </div>

            <style jsx global>{`
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
                .message-container { ... }
                
                .page-container-pdf {
                    width: 100%;
                    height: 100vh;
                    display: flex;
                }
                .pdf-wrapper {
                    position: relative; /* (هام جداً) */
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .pdf-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    /* (سيكون هو الطبقة السفلية) */
                    position: absolute;
                    z-index: 1; 
                }
                
                /* --- [ ✅✅ ستايل العلامة المائية المكررة ] --- */
                .pdf-watermark-overlay {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 2; /* (فوق الـ PDF) */
                    pointer-events: none; /* (لتمرير النقرات للـ PDF) */
                    
                    /* (استخدام Flex لعمل التكرار) */
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden; /* (لضمان عدم خروجها) */
                }
                
                .watermark-tile {
                    /* (كل بلاطة علامة مائية) */
                    padding: 30px 50px; /* (التباعد بين الكلمات) */
                    font-size: 16px;
                    font-weight: bold;
                    color: rgba(128, 128, 128, 0.15); /* (لون رمادي شفاف جداً) */
                    transform: rotate(-30deg); /* (زاوية ميلان) */
                    white-space: nowrap;
                    user-select: none; /* (لمنع التحديد) */
                }
            `}</style>
        </div>
    );
}
