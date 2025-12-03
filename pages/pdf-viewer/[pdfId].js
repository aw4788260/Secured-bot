import { useState, useEffect } from 'react';
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
  const [pdfUrl, setPdfUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setWindowWidth(window.innerWidth);
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // بناء الرابط (سيتم طلبه من المتصفح، والمتصفح سيرسل Referer تلقائياً)
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

  function onDocumentLoadError(error) {
    console.error('PDF Load Error:', error);
    let msg = `تعذر فتح الملف: ${error.message}`;
    if (error.message.includes('403')) msg = '⛔ المصدر غير مصرح به (حاول الفتح من داخل التطبيق فقط).';
    else if (error.message.includes('404')) msg = '❌ الملف غير موجود.';
    setErrorMessage(msg);
  }

  if (!pdfUrl) return <div style={{color:'white', padding:'20px'}}>جاري التحضير...</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      <Head><title>{title || 'عرض المستند'}</title></Head>

      {/* الشريط العلوي */}
      <div style={{
        padding: '15px', background: '#0f172a', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 100, position: 'sticky', top: 0
      }}>
        <button onClick={() => router.back()} style={{background:'none', border:'none', color:'#38bdf8', fontSize:'16px'}}>
          &larr; رجوع
        </button>
        <span style={{fontSize:'14px', maxWidth:'60%', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</span>
        <div style={{fontSize:'12px', color:'#94a3b8'}}>{numPages ? `${numPages} صفحة` : '--'}</div>
      </div>

      {errorMessage ? (
          <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column', color:'white'}}>
              <h2 style={{color:'#ef4444'}}>خطأ</h2>
              <p>{errorMessage}</p>
          </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 0' }}>
            <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div style={{color:'white'}}>جاري التحميل...</div>}
                error={<div></div>}
            >
                {numPages && Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_${index + 1}`} style={{ position: 'relative', marginBottom: '15px' }}>
                        {/* العلامة المائية */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(2, 1fr)',
                            zIndex: 50, pointerEvents: 'none', overflow: 'hidden', opacity: 0.08
                        }}>
                            {Array(2).fill(userId).map((uid, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: 'rotate(-30deg)', color: '#000', fontSize: '24px', fontWeight: 'bold'
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
                        />
                    </div>
                ))}
            </Document>
        </div>
      )}
    </div>
  );
}
