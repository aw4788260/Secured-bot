// pages/view/[pdfId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
// --- [ استيراد المكتبة ] ---
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// --- [ ✅✅ إصلاح #1: نقل إعداد الـ worker إلى دالة ] ---
// (سنستدعي هذه الدالة "فقط" من داخل المتصفح)
function setupPdfJsWorker() {
    if (pdfjs.GlobalWorkerOptions.workerSrc) {
        // (لا تقم بتعيينه مرتين)
        return;
    }
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

// (دالة مخصصة لجلب المستخدم والتحقق منه)
const useUserCheck = (router) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    // --- [ ✅✅ إصلاح #2: جعل الهوك "آمن" للسيرفر ] ---
    useEffect(() => {
        // (لا تقم بتشغيل أي كود حتى نتأكد أننا في المتصفح والراوتر جاهز)
        if (!router.isReady || typeof window === 'undefined') {
            return;
        }

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
    }, [router.isReady, router.query]); // (الاعتماد على router.isReady هو الأهم)
    // --- [ نهاية إصلاح #2 ] ---
    
    return { user, error };
};


export default function ViewPdfPage() {
    const router = useRouter();
    const { pdfId } = router.query;
    const { user, error } = useUserCheck(router);

    const [numPages, setNumPages] = useState(null);
    const [pdfError, setPdfError] = useState(null);

    // --- [ ✅✅ إصلاح #3: جلب عرض الشاشة بأمان من المتصفح ] ---
    const [pageWidth, setPageWidth] = useState(800); // (عرض افتراضي للسيرفر)
    useEffect(() => {
        // (هذا الكود يعمل "فقط" في المتصفح)
        setPageWidth(Math.min(window.innerWidth * 0.95, 800));
        
        // (استدعاء إعداد الـ worker بأمان هنا)
        setupPdfJsWorker(); 
    }, []); // (مصفوفة فارغة = يعمل مرة واحدة عند التحميل في المتصفح)
    // --- [ نهاية إصلاح #3 ] ---
    
    const [watermarkSpans, setWatermarkSpans] = useState([]);
    const watermarkText = user ? `${user.first_name} (${user.id})` : '';

    useEffect(() => {
        if (user) {
            setWatermarkSpans(new Array(100).fill(0));
        }
    }, [user]); 

    // (كود منع الضغط المطول - آمن لأنه داخل useEffect)
    useEffect(() => {
        const disableContextMenu = (e) => e.preventDefault();
        document.addEventListener('contextmenu', disableContextMenu);
        return () => {
            document.removeEventListener('contextmenu', disableContextMenu);
        };
    }, []); 


    // --- [ ✅✅ إصلاح #4: عرض شاشة تحميل أثناء التحقق من المستخدم ] ---
    // (هذا يمنع السيرفر من محاولة عرض الصفحة قبل معرفة المستخدم)
    if (!user && !error) { 
        return (
            <div className="message-container">
                <Head><title>جاري التحميل...</title></Head>
                <h1>جاري التحقق من المستخدم...</h1>
            </div>
        ); 
    }
    // --- [ نهاية إصلاح #4 ] ---

    if (error) { 
        return (
            <div className="message-container">
                <Head><title>خطأ</title></Head>
                <h1>{error}</h1>
            </div>
        ); 
    }
    
    // (الآن نحن بأمان: المستخدم موجود والصفحة في المتصفح)
    if (!pdfId) { 
        return (
            <div className="message-container">
                <Head><title>جاري التحميل...</title></Head>
                <h1>جاري تحميل الملف...</h1>
            </div>
        ); 
    }

    const pdfStreamUrl = `/api/secure/get-pdf?lessonId=${pdfId}`;

    function onDocumentLoadSuccess({ numPages: nextNumPages }) {
        setNumPages(nextNumPages);
        setPdfError(null); 
    }

    function onDocumentLoadError(error) {
        console.error("react-pdf error:", error.message);
        if (error.message.includes('404')) {
             setPdfError('خطأ: لم يتم العثور على الملف (404).');
        } else if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
             setPdfError('خطأ: الملف كبير جداً وتجاوز الوقت المستقطع (504).');
        } else {
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
                        {
                            Array.from(new Array(numPages), (el, index) => (
                                <Page
                                    key={`page_${index + 1}`}
                                    pageNumber={index + 1}
                                    width={pageWidth} // (استخدام العرض الآمن)
                                    className="pdf-page"
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            ))
                        }
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

            <style jsx global>{`
                body, html { margin: 0; padding: 0; }
                
                .message-container { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    height: 100vh; width: 100vw; color: white; padding: 20px; text-align: center; 
                    background: #111827; box-sizing: border-box; position: fixed; top: 0; left: 0; z-index: 1000;
                }
                
                .page-container-pdf {
                    width: 100%;
                    min-height: 100vh; 
                    display: flex;
                    justify-content: center; 
                    background: #111827; 
                }
                .pdf-wrapper {
                    position: relative; 
                    width: 100%;
                    max-width: 800px; 
                    display: flex;
                    justify-content: center;
                    
                    /* (منع الضغط المطول) */
                    -webkit-touch-callout: none; 
                    -webkit-user-select: none; 
                    user-select: none;
                }

                .pdf-document-container {
                    position: relative;
                    z-index: 1; 
                    padding-top: 20px;
                    padding-bottom: 20px;
                }
                .pdf-page {
                    margin-bottom: 10px; 
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                
                .pdf-watermark-overlay {
                    position: fixed; 
                    top: 0; left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 2; 
                    pointer-events: none; 
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
                    user-select: none; 
                }
            `}</style>
        </div>
    );
}
