import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';

// استيراد التنسيقات
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ضبط الـ Worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer() {
  const router = useRouter();
  // [✅] نقرأ فقط معرف الملف والعنوان من الرابط (بيانات غير حساسة)
  const { pdfId, title } = router.query;

  const [windowWidth, setWindowWidth] = useState(0);
  const [pdfData, setPdfData] = useState(null); 
  const [numPages, setNumPages] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // [✅] حالة لتخزين معرف المستخدم للعلامة المائية
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setWindowWidth(window.innerWidth);
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // بدء التحميل والتحقق من الهوية
  useEffect(() => {
    if (!router.isReady || !pdfId) return;

    // 1. استخراج بيانات الدخول من التخزين الآمن
    const uid = localStorage.getItem('auth_user_id');
    const did = localStorage.getItem('auth_device_id');

    if (!uid || !did) {
        // إذا لم يكن مسجلاً، نطرده لصفحة الدخول
        router.replace('/login');
        return;
    }

    // تعيين المعرف للعلامة المائية
    setCurrentUserId(uid);

    // إذا لم يتم تحميل البيانات بعد، نبدأ التحميل
    if (!pdfData) {
        const url = `/api/secure/get-pdf?pdfId=${pdfId}`; // رابط نظيف
        fetchPdfAsBlob(url, uid, did);
    }
  }, [router.isReady, pdfId]);

  // دالة التحميل الكامل (Blob) مع الهيدرز
  const fetchPdfAsBlob = async (url, uid, did) => {
      try {
          const response = await axios.get(url, {
              responseType: 'blob',
              onDownloadProgress: (progressEvent) => {
                  const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                  setDownloadProgress(percentCompleted);
              },
              // [✅] إرسال مفاتيح المرور في الهيدرز المخفية
              headers: {
                  'x-user-id': uid,
                  'x-device-id': did
              }
          });

          setPdfData(response.data);

      } catch (error) {
          console.error("Download Error:", error);
          let msg = "فشل التحميل";
          
          if (error.response) {
              if (error.response.status === 403) msg = "⛔ تم رفض الوصول (تأكد من الجهاز والاشتراك)";
              else if (error.response.status === 404) msg = "❌ الملف غير موجود";
          } else if (error.request) {
              // خطأ في الشبكة أو CORS
              msg = "خطأ في الاتصال بالسيرفر";
          }
          
          setErrorMessage(msg);
          
          // إذا كان الخطأ أمني، يمكن توجيهه للدخول (اختياري)
          if (error.response && error.response.status === 403) {
             // setTimeout(() => router.replace('/login'), 3000);
          }
      }
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setErrorMessage(null);
  }

  // شاشة الانتظار (التحميل)
  if (!pdfData && !errorMessage) {
      return (
        <div style={{minHeight:'100vh', background:'#1e293b', display:'flex', justifyContent:'center', alignItems:'center', color:'white', flexDirection:'column'}}>
            <div className="loading-bar" style={{width:'50px', marginBottom:'15px'}}></div>
            <p style={{fontSize: '18px', fontWeight: 'bold'}}>جاري تحضير الملف...</p>
            <p style={{color: '#38bdf8', marginTop: '10px', fontSize: '16px', fontWeight: 'bold'}}>{downloadProgress}%</p>
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

      {/* شاشة الخطأ */}
      {errorMessage ? (
          <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column', padding:'20px'}}>
              <h2 style={{color:'#ef4444', marginBottom:'10px'}}>فشل العرض</h2>
              <p style={{color:'#cbd5e1', textAlign:'center', marginBottom:'20px'}}>{errorMessage}</p>
              <button onClick={() => window.location.reload()} style={{padding:'10px 20px', background:'#38bdf8', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>
                إعادة المحاولة
              </button>
          </div>
      ) : (
        /* منطقة العرض */
        <div style={{ flex: 1, overflowY: 'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 0', scrollBehavior: 'smooth' }}>
            <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div style={{color:'white', padding:'20px'}}>جاري المعالجة...</div>}
                error={<div style={{color:'red'}}>خطأ في ملف PDF</div>}
            >
                {/* عرض الصفحات */}
                {numPages && Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_${index + 1}`} style={{ position: 'relative', marginBottom: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                        
                        {/* العلامة المائية (تستخدم المعرف من التخزين) */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gridTemplateRows: 'repeat(2, 1fr)',
                            zIndex: 50, pointerEvents: 'none', overflow: 'hidden',
                            opacity: 0.08
                        }}>
                            {/* تكرار المعرف مرتين كخلفية مائية */}
                            {Array(2).fill(currentUserId).map((uid, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: 'rotate(-30deg)', color: '#000',
                                    fontSize: '24px', fontWeight: 'bold', userSelect: 'none'
                                }}>
                                    {uid}
                                </div>
                            ))}
                        </div>
                        
                        {/* الصفحة الفعلية */}
                        <Page 
                            pageNumber={index + 1} 
                            width={windowWidth > 600 ? 600 : windowWidth} 
                            renderTextLayer={false} 
                            renderAnnotationLayer={false}
                            loading={
                                <div style={{height:'300px', width: windowWidth > 600 ? 600 : windowWidth, background:'white'}}></div>
                            }
                        />
                    </div>
                ))}
            </Document>
        </div>
      )}
    </div>
  );
}
