// pages/view/[pdfId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
// --- [ استيراد المكتبة ] ---
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// --- [ ✅ إصلاح: دالة لإعداد الـ worker (تعمل في المتصفح فقط) ] ---
function setupPdfJsWorker() {
    if (pdfjs.GlobalWorkerOptions.workerSrc) return; // (لا تقم بتعيينه مرتين)
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

// --- [ ✅ إصلاح: دالة التحقق من المستخدم (آمنة للسيرفر) ] ---
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        // (لا تعمل إلا في المتصفح والراوتر جاهز)
        if (!router.isReady || typeof window === 'undefined') return;
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');
        const urlFirstName = urlParams.get('firstName');
        
        if (urlUserId && urlUserId.trim() !== '') {
            setUser({ id: urlUserId, first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "User" });
        } else if (window.Telegram && window.Telegram.WebApp) {
             window.Telegram.WebApp.ready();
            const miniAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (miniAppUser) setUser(miniAppUser);
            else setError("لا يمكن التعرف على هويتك.");
        } else {
            setError('الوصول غير مصرح به.');
        }
    }, [router.isReady, router.query]);
    return { user, error };
};


export default function ViewPdfPage() {
    const router = useRouter();
    const { pdfId } = router.query;
    const { user, error } = useUserCheck(router);

    const [numPages, setNumPages] = useState(null);
    const [pdfError, setPdfError] = useState(null);
    const [pageWidth, setPageWidth] = useState(800); // (عرض افتراضي)
    const [watermarkSpans, setWatermarkSpans] = useState([]);
    const watermarkText = user ? `${user.first_name} (${user.id})` : '';

    // (يعمل "فقط" في المتصفح)
    useEffect(() => {
        setPageWidth(Math.min(window.innerWidth * 0.95, 800));
        setupPdfJsWorker(); // (إعداد المكتبة بأمان)
        
        // (إضافة كود منع الضغط المطول)
        const disableContextMenu = (e) => e.preventDefault();
        document.addEventListener('contextmenu', disableContextMenu);
        return () => document.removeEventListener('contextmenu', disableContextMenu);
    }, []); 

    // (إعداد العلامة المائية)
    useEffect(() => {
        if (user) setWatermarkSpans(new Array(100).fill(0));
    }, [user]); 

    // (عرض شاشة تحميل أولية)
    if (!user && !error) { 
        return <div className="message-container"><h1>جاري التحقق...</h1></div>;
    }
    if (error) { 
        return <div className="message-container"><h1>{error}</h1></div>;
    }
    if (!pdfId) { 
        return <div className="message-container"><h1>جاري تحميل الملف...</h1></div>;
    }

    const pdfStreamUrl = `/api/secure/get-pdf?lessonId=${pdfId}`;

    function onDocumentLoadSuccess({ numPages: nextNumPages }) {
        setNumPages(nextNumPages);
    }

    // (دالة اكتشاف الأخطاء)
    async function onDocumentLoadError(error) {
        console.error("react-pdf error:", error.message);
        // (محاولة جلب رسالة الخطأ الحقيقية من الـ API)
        try {
            const res = await fetch(pdfStreamUrl);
            const errorText = await res.text();
            
            if (errorText.includes('Gateway Timeout')) {
                setPdfError('خطأ: الملف كبير جداً وتجاوز الوقت المستقطع (10 ثواني).');
            } else if (errorText.includes('404')) {
                 setPdfError('خطأ: لم يتم العثور على الملف (404).');
            }
            else {
                setPdfError(`فشل تحميل الـ PDF. (خطأ: ${errorText})`);
            }
        } catch (e) {
             setPdfError('فشل تحميل الـ PDF. قد يكون الملف تالفاً أو غير مدعوم.');
        }
    }

    return (
        <div className="page-container-pdf">
            <Head><title>عرض الملف</title></Head>
            <div className="pdf-wrapper">
                <div className="pdf-document-container">
                    <Document
                        file={pdfStreamUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={<div className="message-container"><h1>جاري تحميل الـ PDF...</h1></div>}
                        error={<div className="message-container"><h1>{pdfError || 'خطأ غير معروف'}</h1></div>}
                        options={{
                            cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                            cMapPacked: true,
                        }}
                    >
                        {Array.from(new Array(numPages), (el, index) => (
                            <Page
                                key={`page_${index + 1}`}
                                pageNumber={index + 1}
                                width={pageWidth}
                                className="pdf-page"
                                renderTextLayer={false} // (لزيادة الأمان ومنع النسخ)
                                renderAnnotationLayer={false}
                            />
                        ))}
                    </Document>
                </div>
                {/* (طبقة العلامة المائية) */}
                <div className="pdf-watermark-overlay">
                    {watermarkSpans.map((_, index) => (
                        <span key={index} className="watermark-tile">
                            {watermarkText}
                        </span>
                    ))}
                </div>
            </div>
            
            {/* (كود الـ CSS) */}
            <style jsx global>{`
                body, html { margin: 0; padding: 0; }
                .message-container { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    height: 100vh; width: 100vw; color: white; padding: 20px; text-align: center; 
                    background: #111827; box-sizing: border-box; position: fixed; top: 0; left: 0; z-index: 1000;
                }
                .page-container-pdf { 
                    width: 100%; min-height: 100vh; display: flex; 
                    justify-content: center; background: #111827; 
                }
                .pdf-wrapper { 
                    position: relative; width: 100%; max-width: 800px; 
                    display: flex; justify-content: center; 
                    /* (منع الضغط المطول) */
                    -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; 
                }
                .pdf-document-container { 
                    position: relative; z-index: 1; 
                    padding-top: 20px; padding-bottom: 20px; 
                }
                .pdf-page { 
                    margin-bottom: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); 
                }
                .pdf-watermark-overlay { 
                    position: fixed; top: 0; left: 0; 
                    width: 100%; height: 100%; z-index: 2; 
                    pointer-events: none; display: flex; flex-wrap: wrap; 
                    justify-content: center; align-items: center; 
                    overflow: hidden; background: transparent; 
                }
                .watermark-tile { 
                    padding: 30px 50px; font-size: 16px; font-weight: bold; 
                    color: rgba(128, 128, 128, 0.15); transform: rotate(-30deg); 
                    white-space: nowrap; user-select: none; 
                }
            `}</style>
        </div>
    );
}
