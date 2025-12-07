import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();
  
  const [status, setStatus] = useState('جار تحميل البيانات...');
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  
  // حالات التنقل
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [mode, setMode] = useState(null); 
  
  // بيانات المستخدم
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('videos'); 

  // إعادة تعيين التبويب عند تغيير الشابتر
  useEffect(() => {
      setActiveTab('videos');
  }, [selectedChapter]);

  // ---------------------------------------------------------
  // 1. التحقق من التحديثات (للأندرويد - يعمل داخل التطبيق فقط)
  // ---------------------------------------------------------
  const checkAndTriggerUpdate = async () => {
    if (typeof window === 'undefined' || typeof window.Android === 'undefined' || !window.Android.updateApp) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const currentAppVersion = parseInt(urlParams.get('app_ver') || "0"); 

        const REPO_API_URL = "https://api.github.com/repos/aw4788260/Apk-code-/releases/latest"; 
        const response = await fetch(REPO_API_URL);
        if (!response.ok) return;
        
        const data = await response.json();
        let latestVersionCode = 0;
        const match = data.tag_name.match(/\d+/);
        if (match) latestVersionCode = parseInt(match[0]);

        if (latestVersionCode > currentAppVersion) {
            const apkAsset = data.assets.find(asset => asset.name.endsWith(".apk"));
            if (!apkAsset) return;

            const msg = `تحديث ضروري متوفر (v${latestVersionCode})!\n\nلضمان عمل التطبيق، يجب التحديث الآن.`;
            if (confirm(msg)) {
                window.Android.updateApp(apkAsset.browser_download_url, String(latestVersionCode));
            } else {
                if (window.Android.closeApp) window.Android.closeApp();
                else location.reload();
            }
        }
    } catch (err) {
        console.error("Update check failed:", err);
    }
  };

  // ---------------------------------------------------------
  // 2. المحرك الرئيسي: التحقق من الهوية وجلب البيانات
  // ---------------------------------------------------------
  useEffect(() => {
    // تشغيل فحص التحديث
    checkAndTriggerUpdate();

    // أ) استرجاع البيانات من الذاكرة الآمنة
    const uid = localStorage.getItem('auth_user_id');
    const did = localStorage.getItem('auth_device_id');
    const fname = localStorage.getItem('auth_first_name');

    // ب) إذا لم نجد بيانات -> طرد للمستخدم
    if (!uid || !did) {
        router.replace('/login');
        return;
    }

    // ج) تعيين بيانات المستخدم
    setUser({ id: uid, first_name: fname });

    // د) جلب المواد (إرسال الهوية في الهيدرز المخفية)
    fetch('/api/data/get-structured-courses', {
        headers: {
            'x-user-id': uid,
            'x-device-id': did
        }
    })
    .then(res => {
        if (res.status === 403) throw new Error("⛔ تم رفض الوصول (جهاز غير مطابق أو حظر)");
        return res.json();
    })
    .then(data => {
        if (!Array.isArray(data)) throw new Error("بيانات غير صالحة");
        setSubjects(data);
        setStatus(null);
    })
    .catch(err => {
        console.error("Fetch Error:", err);
        setError(err.message);
        // إذا كان الخطأ أمني، نحوله للدخول
        if (err.message.includes("رفض")) {
            localStorage.clear();
            router.replace('/login');
        }
    });

  // هـ) التحقق من صلاحية الأدمن + فحص نوع الجهاز (Logic Updated)
  fetch('/api/auth/check-admin', { 
        method: 'GET',
        headers: {
            'x-user-id': uid,    // المفتاح الأول
            'x-device-id': did   // المفتاح الثاني (البصمة)
        }
    })
    .then(res => res.json())
    .then(data => {
        const userIsAdmin = data.isAdmin;
        if (userIsAdmin) {
            setIsAdmin(true);
        }

        // ================================================================
        // 🔥 التعديل الجديد: السماح فقط للأدمن أو الآيفون (وحماية التطبيق)
        // ================================================================
        if (typeof window !== 'undefined') {
            const ua = window.navigator.userAgent.toLowerCase();
            
            // 1. هل هو آيفون/آيباد؟
            const isIos = /iphone|ipad|ipod/.test(ua);
            
            // 2. هل هو تطبيق الأندرويد الرسمي؟ (نعرفه بوجود الـ Interface)
            // هذا الشرط ضروري لكي لا يتوقف التطبيق عن العمل، بينما يتم حظر المتصفح العادي
            const isAndroidApp = typeof window.Android !== 'undefined';

            // الشرط: إذا لم يكن أدمن.. ولم يكن آيفون.. ولم يكن التطبيق الرسمي -> حظر
            if (!userIsAdmin && !isIos && !isAndroidApp) {
                setError("⛔ غير مسموح بالدخول من أندرويد عبر المتصفح/تليجرام. يرجى استخدام التطبيق الرسمي أو جهاز iPhone.");
                setStatus(null); 
                return;
            }
        }
        // ================================================================
    })
    .catch(e => console.log("Not admin check failed", e));

  }, []);

  // ---------------------------------------------------------
  // 3. واجهة المستخدم (UI)
  // ---------------------------------------------------------

  if (error) {
    return (
        <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Head><title>خطأ</title></Head>
            <h1 style={{color:'#ef4444', textAlign: 'center', lineHeight: '1.6', padding: '20px'}}>{error}</h1>
            {/* إخفاء زر العودة إذا كان الخطأ بسبب نوع الجهاز */}
            {!error.includes("غير مسموح") && (
                <button className="back-button" onClick={() => router.replace('/login')}>تسجيل الدخول مجدداً</button>
            )}
        </div>
    );
  }

  if (status || !user) {
    return (
      <div className="app-container loader-container">
        <Head><title>جاري التحميل...</title></Head>
        <h1>{status}</h1>
        <div className="loading-bar"></div>
      </div>
    );
  }

  // === المستوى 3: عرض الشابتر (فيديوهات / ملفات) ===
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        
        <button className="back-button" onClick={() => setSelectedChapter(null)}>
          &larr; رجوع إلى {selectedSubject.title}
        </button>
        
        <h1 style={{marginBottom: '15px'}}>{selectedChapter.title}</h1>

        {/* التبويبات */}
        <div style={{
            display: 'flex', justifyContent: 'space-between', backgroundColor: '#1f2937',
            padding: '5px', borderRadius: '25px', marginBottom: '20px', border: '1px solid #374151'
        }}>
            <button onClick={() => setActiveTab('videos')}
                style={{
                    flex: 1, padding: '10px', borderRadius: '20px', border: 'none',
                    backgroundColor: activeTab === 'videos' ? '#38bdf8' : 'transparent',
                    color: activeTab === 'videos' ? '#000000' : '#ffffff',
                    fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease'
                }}>
                فيديوهات 🎬
            </button>
            <button onClick={() => setActiveTab('pdfs')}
                style={{
                    flex: 1, padding: '10px', borderRadius: '20px', border: 'none',
                    backgroundColor: activeTab === 'pdfs' ? '#38bdf8' : 'transparent',
                    color: activeTab === 'pdfs' ? '#000000' : '#ffffff',
                    fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease'
                }}>
                ملفات PDF 📄
            </button>
        </div>

        <ul className="item-list">
          {/* الفيديوهات */}
          {activeTab === 'videos' && (
            <>
                {selectedChapter.videos.length > 0 ? (
                    selectedChapter.videos.map(video => (
                        <li key={`video-${video.id}`}>
                            <div 
                                className="button-link video-link"
                                onClick={() => router.push(`/watch/${video.id}`)}
                                style={{ cursor: 'pointer' }}
                            >
                                ▶️ {video.title}
                            </div>
                        </li>
                    ))
                ) : (
                    <div style={{textAlign: 'center', padding: '40px', color: '#9ca3af'}}><p>🚫 لا توجد فيديوهات</p></div>
                )}
            </>
          )}

          {/* الملفات */}
          {activeTab === 'pdfs' && (
            <>
                {selectedChapter.pdfs && selectedChapter.pdfs.length > 0 ? (
                    selectedChapter.pdfs.map(pdf => (
                        <li key={`pdf-${pdf.id}`}>
                            <div 
                                className="button-link"
                                style={{cursor: 'pointer', borderRight: '4px solid #ef4444'}}
                                onClick={() => router.push(`/pdf-viewer/${pdf.id}?title=${encodeURIComponent(pdf.title)}`)}
                            >
                                📄 {pdf.title}
                            </div>
                        </li>
                    ))
                ) : (
                    <div style={{textAlign: 'center', padding: '40px', color: '#9ca3af'}}><p>🚫 لا توجد ملفات</p></div>
                )}
            </>
          )}
        </ul>        
        
        <footer className="developer-info">
          <p>برمجة وتطوير: A7MeD WaLiD</p>
        </footer>
      </div>
    );
  }

  // === المستوى 2: اختيار القسم (شرح / امتحانات) ===
  if (selectedSubject) {
    // أ) لم يختر بعد
    if (mode === null) {
      const exams = selectedSubject.exams || []; 
      return (
        <div className="app-container">
          <Head><title>{selectedSubject.title}</title></Head>
          <button className="back-button" onClick={() => setSelectedSubject(null)}>&larr; القائمة الرئيسية</button>
          <h1>{selectedSubject.title}</h1>
          <ul className="item-list">
            <li>
              <button className="button-link" onClick={() => setMode('lectures')}>
                📁 الشرح والمحتوى
                <span>({selectedSubject.chapters.length} شابتر)</span>
              </button>
            </li>
            <li>
              <button className="button-link" onClick={() => setMode('exams')}>
                ✏️ الامتحانات
                <span>({exams.length} امتحان)</span>
              </button>
            </li>
          </ul>
        </div>
      );
    }
    
    // ب) قسم الشرح
    if (mode === 'lectures') {
      return (
        <div className="app-container">
          <Head><title>الشرح</title></Head>
          <button className="back-button" onClick={() => setMode(null)}>&larr; رجوع</button>
          <h1>{selectedSubject.title}</h1>
          <ul className="item-list">
            {selectedSubject.chapters.length > 0 ? (
              selectedSubject.chapters.map(chapter => (
                <li key={chapter.id}>
                  <button className="button-link" onClick={() => setSelectedChapter(chapter)}>
                    📁 {chapter.title}
                    <span>({chapter.videos.length} فيديو)</span>
                  </button>
                </li>
              ))
            ) : (
              <p style={{ color: '#aaa' }}>لا توجد محتويات.</p>
            )}
          </ul>
        </div>
      );
    }

    // ج) قسم الامتحانات
    if (mode === 'exams') {
      const exams = selectedSubject.exams || []; 
      return (
        <div className="app-container">
          <Head><title>الامتحانات</title></Head>
          <button className="back-button" onClick={() => setMode(null)}>&larr; رجوع</button>
          <h1>الامتحانات المتاحة</h1>
          <ul className="item-list">
            {exams.length > 0 ? (
              exams.map(exam => {
                const href = !exam.is_completed ? `/exam/${exam.id}` : `/results/${exam.first_attempt_id}`;
                const examTitle = `✏️ ${exam.title} ${exam.is_completed ? '✅' : ''}`;
                return (
                  <li key={exam.id}>
                    <div className="button-link" onClick={() => router.push(href)} style={{ cursor: 'pointer' }}>
                      {examTitle}
                    </div>
                  </li>
                );
              })
            ) : (
              <p style={{ color: '#aaa' }}>لا توجد امتحانات.</p>
            )}
          </ul>
        </div>
      );
    }
  }

  // === المستوى 1: القائمة الرئيسية ===
  return (
    <div className="app-container">
      <Head><title>المواد المتاحة</title></Head>
      
      {isAdmin && (
        <button 
            className="button-link" 
            style={{background: '#334155', border: '1px dashed #38bdf8', marginBottom: '20px', justifyContent:'center'}}
            onClick={() => router.push('/admin')}
        >
            ⚙️ لوحة الأدمن
        </button>
      )}

      <h1>المواد المتاحة</h1>
      <ul className="item-list">
        {subjects.length > 0 ? (
           subjects.map(subject => (
            <li key={subject.id}>
              <button className="button-link" onClick={() => { setSelectedSubject(subject); setMode(null); }}>
                📚 {subject.title} 
                <span>({subject.chapters.length} شابتر)</span>
              </button>
            </li>
           ))
        ) : (
           <p style={{ color: '#aaa' }}>لا توجد مواد متاحة.</p>
        )}
      </ul>
      
      <footer className="developer-info">
         <p>برمجة وتطوير: A7MeD WaLiD</p>
         <p>للتواصل: <a href="https://t.me/A7MeDWaLiD0" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
      </footer>
    </div>
  );
}
