import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Document, Page, pdfjs } from 'react-pdf';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer() {
  const router = useRouter();
  const { pdfId, userId, deviceId, title } = router.query;

  const [numPages, setNumPages] = useState(null);
  const [windowWidth, setWindowWidth] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setWindowWidth(window.innerWidth);
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // ✅ تجهيز كائن الملف مع الهيدرز (هذا هو التغيير الجوهري)
  const fileObj = useMemo(() => {
    if (!pdfId || !userId || !deviceId) return null;
    return {
        // الرابط أصبح نظيفاً (بدون userId و deviceId) ليتم تخزينه نسخة واحدة
        url: `/api/secure/get-pdf?pdfId=${pdfId}`,
        // البيانات الحساسة تنتقل هنا
        httpHeaders: {
            'x-user-id': userId,
            'x-device-id': deviceId
        },
        withCredentials: true
    };
  }, [pdfId, userId, deviceId]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setErrorMessage(null); 
  }

  function onDocumentLoadError(error) {
    console.error('PDF Load Error:', error);
    let uiErrorMsg = `تعذر فتح الملف: ${error.message}`;
    
    if (error.message.includes('403')) uiErrorMsg = '⛔ غير مصرح لك (تأكد من الاشتراك أو الجهاز).';
    else if (error.message.includes('404')) uiErrorMsg = '❌ الملف غير موجود.';
    else if (error.message.includes('500')) uiErrorMsg = '⚠️ خطأ في السيرفر.';
    
    setErrorMessage(uiErrorMsg);
    
    if (userId) {
        fetch('/api/log-client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                msg: `❌ PDF Failure | PDF ID: ${pdfId} | Error: ${error.message}`, 
                userId: userId 
            })
        }).catch(() => {});
    }
  }

  if (!fileObj) {
      return (
        <div style={{minHeight:'100vh', background:'#1e293b', display:'flex', justifyContent:'center', alignItems:'center', color:'white', flexDirection:'column'}}>
            <div className="loading-bar" style={{width:'50px', marginBottom:'10px'}}></div>
            <p>جاري تحضير الملف...</p>
        </div>
      );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      <Head><title>{title || 'عرض المستند'}</title></Head>

      <div style={{
        padding: '15px', background: '#0f172a', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 100, position: 'sticky', top: 0
      }}>
        <button onClick={() => router.back()} style={{background:'none', border:'none', color:'#38bdf8', fontSize:'16px', cursor:'pointer', fontWeight:'bold'}}>
          &larr; رجوع
        </button>
        <span style={{fontSize:'14px', maxWidth:'60%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {title}
        </span>
        <div style={{fontSize:'12px', color:'#94a3b8', minWidth:'40px', textAlign:'left'}}>
          {numPages ? `${numPages} صفحة` : '--'}
        </div>
      </div>

      {errorMessage ? (
          <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column', padding:'20px'}}>
              <h2 style={{color:'#ef4444', marginBottom:'10px'}}>فشل العرض</h2>
              <p style={{color:'#cbd5e1', textAlign:'center', marginBottom:'20px'}}>{errorMessage}</p>
              <button onClick={() => window.location.reload()} style={{padding:'10px 20px', background:'#38bdf8', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>
                إعادة المحاولة
              </button>
          </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 0', scrollBehavior: 'smooth' }}>
            <Document
                file={fileObj} // ✅ تم استبدال الرابط بالكائن الجديد
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div style={{color:'white', marginTop:'50px'}}>جاري تحميل الملف...</div>}
                error={<div></div>}
            >
                {numPages && Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_${index + 1}`} style={{ position: 'relative', marginBottom: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(2, 1fr)',
                            zIndex: 50, pointerEvents: 'none', overflow: 'hidden', opacity: 0.08
                        }}>
                            {Array(2).fill(userId).map((uid, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: 'rotate(-30deg)', color: '#000', fontSize: '24px', fontWeight: 'bold', userSelect: 'none'
                                }}>
                                    {uid}
                                </div>
                            ))}
                        </div>
                        <Page 
                            pageNumber={index + 1} 
                            width={windowWidth > 600 ? 600 : windowWidth} 
                            renderTextLayer={false} 
                            renderAnnotationLayer={false}
                            loading={<div style={{height:'300px', width: windowWidth > 600 ? 600 : windowWidth, background:'white'}}></div>}
                        />
                    </div>
                ))}
            </Document>
        </div>
      )}
    </div>
  );
}
