// pages/view/[pdfId].js
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
// (استيراد المكتبة)
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// (تحديد مسار الـ worker)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// (دالة التحقق من المستخدم - انسخها من رد سابق)
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

    const [numPages, setNumPages] = useState(null);
    const [pdfError, setPdfError] = useState(null);
    const [watermarkSpans, setWatermarkSpans] = useState([]);
    const watermarkText = user ? `${user.first_name} (${user.id})` : '';

    useEffect(() => {
        if (user) setWatermarkSpans(new Array(100).fill(0));
    }, [user]); 

    useEffect(() => {
        const disableContextMenu = (e) => e.preventDefault();
        document.addEventListener('contextmenu', disableContextMenu);
        return () => document.removeEventListener('contextmenu', disableContextMenu);
    }, []); 

    if (error) { /* ... كود عرض الخطأ ... */ }
    if (!user || !pdfId) { /* ... كود التحميل ... */ }

    const pdfStreamUrl = `/api/secure/get-pdf?lessonId=${pdfId}`;

    function onDocumentLoadSuccess({ numPages: nextNumPages }) {
        setNumPages(nextNumPages);
    }

    function onDocumentLoadError(error) {
        console.error("react-pdf error:", error.message);
        // --- [ ✅✅ هنا مكان الخطأ المتوقع ] ---
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            setPdfError('خطأ أمان (CORS): البرنامج يمنع تحميل الملف مباشرة من سيرفر تليجرام.');
        } else {
            setPdfError(`فشل تحميل الـ PDF: ${error.message}`);
        }
    }

    return (
        <div className="page-container-pdf">
            <Head><title>عرض الملف</title></Head>
            <div className="pdf-wrapper">
                
                <div className="pdf-document-container">
                    <Document
                        file={pdfStreamUrl} // (هنا سيتم استدعاء الـ API)
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError} // (هذه الدالة ستعمل وتعرض الخطأ)
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
                                width={Math.min(window.innerWidth * 0.95, 800)} 
                                className="pdf-page"
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                            />
                        ))}
                    </Document>
                </div>

                {/* (طبقة العلامة المائية المكررة) */}
                <div className="pdf-watermark-overlay">
                    {watermarkSpans.map((_, index) => (
                        <span key={index} className="watermark-tile">
                            {watermarkText}
                        </span>
                    ))}
                </div>

            </div>

            {/* (انسخ ستايل الـ CSS من الرد السابق) */}
            <style jsx global>{`
                /* ... (نفس كود الـ CSS بالكامل) ... */
                .page-container-pdf { /* ... */ }
                .pdf-wrapper { /* ... */ }
                .pdf-document-container { /* ... */ }
                .pdf-watermark-overlay { /* ... */ }
                .watermark-tile { /* ... */ }
            `}</style>
        </div>
    );
}
