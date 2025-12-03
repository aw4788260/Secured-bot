import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PdfViewer() {
  const router = useRouter();
  const { pdfId, userId, deviceId, title } = router.query;
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    window.addEventListener('resize', () => setWindowWidth(window.innerWidth));
    return () => window.removeEventListener('resize', () => {});
  }, []);

  const pdfUrl = pdfId ? `/api/secure/get-pdf?pdfId=${pdfId}&userId=${userId}&deviceId=${deviceId}` : null;

  if (!pdfUrl) return <div className="app-container">جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      <Head><title>{title}</title></Head>
      <div style={{ padding: '10px', background: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => router.back()} style={{color:'#38bdf8', background:'none', border:'none', fontSize:'16px'}}>&larr; رجوع</button>
        <span style={{color:'white', fontSize:'14px'}}>{pageNumber} / {numPages}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display:'flex', justifyContent:'center', padding:'10px', position:'relative' }}>
        <Document file={pdfUrl} onLoadSuccess={({numPages}) => setNumPages(numPages)} loading={<div style={{color:'white'}}>جاري التحميل...</div>}>
           {/* العلامة المائية */}
           <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', zIndex:50, pointerEvents:'none', display:'grid', gridTemplateColumns:'repeat(2, 1fr)', opacity:0.1}}>
              {Array(10).fill(userId).map((uid, i) => <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'center', transform:'rotate(-45deg)', fontSize:'20px', fontWeight:'bold'}}>{uid}</div>)}
           </div>
           <Page pageNumber={pageNumber} width={windowWidth > 600 ? 600 : windowWidth - 20} renderTextLayer={false} renderAnnotationLayer={false} />
        </Document>
      </div>

      <div style={{ padding: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', position:'sticky', bottom:0, zIndex:100 }}>
        <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="button-link" style={{width:'auto', padding:'8px 20px', background:'#38bdf8', color:'black'}}>السابق</button>
        <button disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)} className="button-link" style={{width:'auto', padding:'8px 20px', background:'#38bdf8', color:'black'}}>التالي</button>
      </div>
    </div>
  );
}
