import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Document, Page, pdfjs } from 'react-pdf';

// استيراد ملفات التنسيق الضرورية لظهور الـ PDF بشكل صحيح
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ✅ [إصلاح] استخدام رابط CDN دقيق وصحيح للـ Worker (بصيغة mjs للإصدارات الحديثة)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer() {
  const router = useRouter();
  const { pdfId, userId, deviceId, title } = router.query;

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [windowWidth, setWindowWidth] = useState(0);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // 1. ضبط العرض للموبايل
  useEffect(() => {
    if (typeof window !== 'undefined') {
        setWindowWidth(window.innerWidth);
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // 2. بناء الرابط
  useEffect(() => {
    if (router.isReady && pdfId && userId && deviceId) {
        const url = `/api/secure/get-pdf?pdfId=${pdfId}&userId=${userId}&deviceId=${deviceId}`;
        setPdfUrl(url);
    }
  }, [router.isReady, pdfId, userId, deviceId]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setErrorMessage(null); 
  }

  // 3. معالجة الأخطاء
  function onDocumentLoadError(error) {
    console.error('PDF Load Error:', error);
    let uiErrorMsg = `تعذر فتح الملف: ${error.message}`;
    
    if (error.message.includes('403')) uiErrorMsg = '⛔ غير مصرح لك (تأكد من الاشتراك أو الجهاز).';
    else if (error.message.includes('404')) uiErrorMsg = '❌ الملف غير موجود.';
    else if (error.message.includes('500')) uiErrorMsg = '⚠️ خطأ في السيرفر.';
    else if (error.message.includes('worker')) uiErrorMsg = '⚠️ خطأ في تحميل ملفات النظام (Worker).';

    setErrorMessage(uiErrorMsg);
    
    // إرسال اللوج للسيرفر
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

  // شاشة الانتظار
  if (!pdfUrl) {
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

      {/* الشريط العلوي */}
      <div style={{
        padding: '15px', background: '#0f172a', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 100
      }}>
        <button onClick={() => router.back()} style={{background:'none', border:'none', color:'#38bdf8', fontSize:'16px', cursor:'pointer', fontWeight:'bold'}}>
          &larr; رجوع
        </button>
        <span style={{fontSize:'14px', maxWidth:'60%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {title}
        </span>
        <div style={{fontSize:'12px', color:'#94a3b8', minWidth:'40px', textAlign:'left'}}>
          {numPages ? `${pageNumber} / ${numPages}` : '--'}
        </div>
      </div>

      {/* منطقة عرض الخطأ */}
      {errorMessage ? (
          <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column', padding:'20px'}}>
              <h2 style={{color:'#ef4444', marginBottom:'10px'}}>فشل العرض</h2>
              <p style={{color:'#cbd5e1', textAlign:'center', marginBottom:'20px'}}>{errorMessage}</p>
              <button onClick={() => window.location.reload()} style={{padding:'10px 20px', background:'#38bdf8', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>
                إعادة المحاولة
              </button>
          </div>
      ) : (
        /* منطقة الـ PDF */
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', display:'flex', justifyContent:'center', padding:'10px 0' }}>
            <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div style={{color:'white', marginTop:'50px'}}>جاري تحميل الصفحات...</div>}
                error={<div></div>} // إخفاء الرسالة الافتراضية
            >
                <div style={{ position: 'relative', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                    {/* العلامة المائية */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', 
                        zIndex: 50, pointerEvents: 'none', overflow: 'hidden', opacity: 0.15
                    }}>
                        {Array(20).fill(userId).map((uid, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transform: 'rotate(-30deg)', color: '#000',
                                fontSize: '16px', fontWeight: 'bold', userSelect: 'none'
                            }}>
                                {uid}
                            </div>
                        ))}
                    </div>
                    
                    {/* الصفحة */}
                    <Page 
                        pageNumber={pageNumber} 
                        width={windowWidth > 600 ? 600 : windowWidth} 
                        renderTextLayer={false} 
                        renderAnnotationLayer={false} 
                    />
                </div>
            </Document>
        </div>
      )}

      {/* أزرار التحكم */}
      {!errorMessage && numPages && (
        <div style={{
          padding: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around',
          borderTop: '1px solid #334155', position: 'sticky', bottom: 0, zIndex: 100
        }}>
          <button 
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(prev => prev - 1)}
            className="button-link"
            style={{width:'auto', padding:'8px 25px', background: pageNumber <= 1 ? '#334155' : '#38bdf8', color: pageNumber <= 1 ? '#94a3b8' : '#0f172a', fontWeight:'bold'}}
          >
            السابق
          </button>
          
          <button 
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(prev => prev + 1)}
            className="button-link"
            style={{width:'auto', padding:'8px 25px', background: pageNumber >= numPages ? '#334155' : '#38bdf8', color: pageNumber >= numPages ? '#94a3b8' : '#0f172a', fontWeight:'bold'}}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
