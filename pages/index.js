import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();
  
  const [status, setStatus] = useState('جار فحص البيانات وتجهيز المكتبة...');
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

  useEffect(() => { setActiveTab('videos'); }, [selectedChapter]);

  // --- دالة الطرد الآمن (لحل مشكلة الدوامة) ---
  const forceLogout = () => {
      // 1. تنظيف اللوكال ستوريج
      localStorage.removeItem('auth_user_id');
      localStorage.removeItem('auth_first_name');
      // localStorage.removeItem('auth_device_id'); // نترك بصمة الجهاز

      // 2. حرق الكوكيز يدوياً
      document.cookie = "student_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";

      // 3. التوجيه لصفحة الدخول
      router.replace('/login');
  };

  // --- التحقق من التحديثات ---
  const checkAndTriggerUpdate = async () => {
    if (typeof window === 'undefined' || typeof window.Android === 'undefined' || !window.Android.updateApp) return;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const currentAppVersion = parseInt(urlParams.get('app_ver') || "0"); 
        const response = await fetch("https://api.github.com/repos/aw4788260/Apk-code-/releases/latest");
        if (!response.ok) return;
        const data = await response.json();
        let latestVersionCode = 0;
        const match = data.tag_name.match(/\d+/);
        if (match) latestVersionCode = parseInt(match[0]);
        if (latestVersionCode > currentAppVersion) {
            const apkAsset = data.assets.find(asset => asset.name.endsWith(".apk"));
            if (!apkAsset) return;
            if (confirm(`تحديث جديد (v${latestVersionCode}) متوفر. هل تريد التحديث الآن؟`)) {
                window.Android.updateApp(apkAsset.browser_download_url, String(latestVersionCode));
            }
        }
    } catch (err) { console.error(err); }
  };

  // --- المحرك الرئيسي ---
  useEffect(() => {
    checkAndTriggerUpdate();

    const uid = localStorage.getItem('auth_user_id');
    const did = localStorage.getItem('auth_device_id');
    const fname = localStorage.getItem('auth_first_name');

    if (!uid || !did) { forceLogout(); return; }
    setUser({ id: uid, first_name: fname });

    // جلب المواد
    fetch('/api/data/get-structured-courses', { headers: { 'x-user-id': uid, 'x-device-id': did } })
    .then(res => {
        if (res.status === 403 || res.status === 401) throw new Error("SESSION_EXPIRED");
        return res.json();
    })
    .then(data => {
        if (!Array.isArray(data)) throw new Error("بيانات غير صالحة");
        setSubjects(data);
        setStatus(null);
    })
    .catch(err => {
        console.error("Fetch Error:", err);
        if (err.message === "SESSION_EXPIRED" || err.message.includes("رفض")) {
            forceLogout();
        } else {
            setError("حدث خطأ في الاتصال بالسيرفر. تأكد من الإنترنت.");
        }
    });

    // فحص الأدمن والحماية
    fetch('/api/auth/check-admin', { headers: { 'x-user-id': uid, 'x-device-id': did } })
    .then(r=>r.json()).then(d=> { 
        if(d.isAdmin) setIsAdmin(true); 
        
        // حماية المتصفح
        if (typeof window !== 'undefined') {
            const ua = window.navigator.userAgent.toLowerCase();
            const isIos = /iphone|ipad|ipod/.test(ua);
            const isAndroidApp = typeof window.Android !== 'undefined';
            if (!d.isAdmin && !isIos && !isAndroidApp) {
                setError("⛔ غير مسموح بالدخول من المتصفح. استخدم التطبيق الرسمي.");
                setStatus(null);
            }
        }
    })
    .catch(() => {});
  }, []);


  // ==========================================
  // واجهة المستخدم (UI)
  // ==========================================

  if (error) {
    return (
        <div className="error-screen">
            <h3>⚠️ تنبيه</h3>
            <p>{error}</p>
            {!error.includes("غير مسموح") && (
                <button className="back-btn-error" onClick={forceLogout}>تسجيل الدخول مجدداً</button>
            )}
        </div>
    );
  }

  if (status || !user) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>{status}</p>
      </div>
    );
  }

  // 1. عرض المحتوى (فيديوهات / ملفات)
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        
        <header className="chapter-header">
            <button className="nav-back" onClick={() => setSelectedChapter(null)}>
                ➜ رجوع للفصول
            </button>
            <h2>{selectedChapter.title}</h2>
        </header>

        <div className="tabs-container">
            <button onClick={() => setActiveTab('videos')} className={`tab-btn ${activeTab === 'videos' ? 'active' : ''}`}>
                📺 فيديوهات
            </button>
            <button onClick={() => setActiveTab('pdfs')} className={`tab-btn ${activeTab === 'pdfs' ? 'active' : ''}`}>
                📄 مذكرات PDF
            </button>
        </div>

        <div className="content-list animated-list">
          {activeTab === 'videos' && (
            selectedChapter.videos.length > 0 ? selectedChapter.videos.map(v => (
                <div key={v.id} className="content-card video" onClick={() => router.push(`/watch/${v.id}`)}>
                    <span className="icon">▶️</span>
                    <span className="text">{v.title}</span>
                </div>
            )) : <div className="empty-state">لا توجد فيديوهات حالياً</div>
          )}

          {activeTab === 'pdfs' && (
            selectedChapter.pdfs?.length > 0 ? selectedChapter.pdfs.map(p => (
                <div key={p.id} className="content-card pdf" onClick={() => router.push(`/pdf-viewer/${p.id}?title=${encodeURIComponent(p.title)}`)}>
                    <span className="icon">📑</span>
                    <span className="text">{p.title}</span>
                </div>
            )) : <div className="empty-state">لا توجد ملفات</div>
          )}
        </div>
      </div>
    );
  }

  // 2. داخل المادة (اختيار القسم)
  if (selectedSubject) {
    if (mode === null) {
      return (
        <div className="app-container">
          <Head><title>{selectedSubject.title}</title></Head>
          <header className="subject-header">
              <button className="nav-back" onClick={() => setSelectedSubject(null)}>➜ الرئيسية</button>
              <h1>📚 {selectedSubject.title}</h1>
          </header>
          
          <div className="mode-grid">
              <div className="mode-card lectures" onClick={() => setMode('lectures')}>
                  <div className="icon">👨‍🏫</div>
                  <h3>المحاضرات</h3>
                  <p>{selectedSubject.chapters.length} فصل دراسي</p>
              </div>
              <div className="mode-card exams" onClick={() => setMode('exams')}>
                  <div className="icon">📝</div>
                  <h3>الامتحانات</h3>
                  <p>{selectedSubject.exams?.length || 0} امتحان شامل</p>
              </div>
          </div>
        </div>
      );
    }
    
    if (mode === 'lectures') {
      return (
        <div className="app-container">
          <button className="nav-back sticky" onClick={() => setMode(null)}>➜ القائمة السابقة</button>
          <h2 className="section-title">فصول المادة</h2>
          <div className="chapters-list animated-list">
            {selectedSubject.chapters.length > 0 ? (
                selectedSubject.chapters.map(ch => (
                    <div key={ch.id} className="chapter-card" onClick={() => setSelectedChapter(ch)}>
                        <div className="ch-icon">📁</div>
                        <div className="ch-info">
                            <h3>{ch.title}</h3>
                            <span>{ch.videos.length} فيديو</span>
                        </div>
                        <div className="arrow">⬅</div>
                    </div>
                ))
            ) : <p className="empty-state">لا توجد فصول مضافة بعد.</p>}
          </div>
        </div>
      );
    }

    if (mode === 'exams') {
      return (
        <div className="app-container">
          <button className="nav-back sticky" onClick={() => setMode(null)}>➜ القائمة السابقة</button>
          <h2 className="section-title">الامتحانات</h2>
          <div className="exams-list animated-list">
            {selectedSubject.exams?.length > 0 ? (
                selectedSubject.exams.map(ex => (
                    <div key={ex.id} className={`exam-card ${ex.is_completed ? 'completed' : ''}`} 
                         onClick={() => router.push(!ex.is_completed ? `/exam/${ex.id}` : `/results/${ex.first_attempt_id}`)}>
                        <div className="ex-icon">{ex.is_completed ? '✅' : '⏳'}</div>
                        <div className="ex-info">
                            <h3>{ex.title}</h3>
                            <span>{ex.is_completed ? 'تم الحل (عرض النتيجة)' : 'ابدأ الامتحان'}</span>
                        </div>
                    </div>
                ))
            ) : <p className="empty-state">لا توجد امتحانات مضافة.</p>}
          </div>
        </div>
      );
    }
  }

  // 3. الصفحة الرئيسية (مكتبة الطالب)
  return (
    <div className="app-container home-bg">
      <Head><title>مكتبتي التعليمية</title></Head>
      
      <header className="home-header">
          <div className="welcome-text">
              <p>أهلاً بك 👋</p>
              <h2>{user?.first_name}</h2>
          </div>
          <div className="header-actions">
              {/* زر المتجر في الهيدر */}
              <button className="icon-btn store" onClick={() => router.push('/student/courses')} title="متجر الكورسات">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </button>
              {isAdmin && (
                  <button className="icon-btn" onClick={() => router.push('/admin')} title="لوحة التحكم">
                      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
              )}
          </div>
      </header>

      {/* Store Banner */}
      <div className="store-banner" onClick={() => router.push('/student/courses')}>
          <div className="banner-content">
              <h3>هل تريد المزيد؟</h3>
              <p>تصفح المتجر واشترك في كورسات جديدة 🛒</p>
          </div>
          <div className="banner-arrow">⬅</div>
      </div>

      {/* My Courses Grid */}
      <section className="my-courses-section">
          <h3 className="section-head">مكتبتي (المواد المشترك بها)</h3>
          
          {subjects.length > 0 ? (
              <div className="subjects-grid">
                  {subjects.map(sub => (
                      <div key={sub.id} className="subject-card main" onClick={() => { setSelectedSubject(sub); setMode(null); }}>
                          <div className="sub-icon">⚛️</div>
                          <div className="sub-details">
                              <h4>{sub.title}</h4>
                              <span>{sub.chapters.length} شابتر</span>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="empty-home">
                  <div className="ghost-icon">📭</div>
                  <p>أنت غير مشترك في أي مادة حتى الآن.</p>
                  <button className="subscribe-now-btn" onClick={() => router.push('/student/courses')}>اشترك الآن</button>
              </div>
          )}
      </section>

      <footer className="developer-info">
         <p>برمجة وتطوير: A7MeD WaLiD</p>
      </footer>

      <style jsx global>{`
        /* Reset & Base */
        body { margin: 0; background: #0f172a; color: white; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-tap-highlight-color: transparent; }
        .app-container { min-height: 100vh; padding: 20px; max-width: 600px; margin: 0 auto; position: relative; }
        
        /* Loading & Error */
        .loading-screen, .error-screen { height: 100vh; display: flex; flex-direction: column; justify-content: center; alignItems: center; text-align: center; padding: 20px; }
        .error-screen h3 { color: #ef4444; font-size: 1.5em; margin-bottom: 10px; }
        .error-screen p { color: #cbd5e1; line-height: 1.6; }
        .back-btn-error { margin-top: 20px; padding: 10px 20px; background: #334155; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .spinner { width: 40px; height: 40px; border: 4px solid #334155; border-top: 4px solid #38bdf8; border-radius: 50%; animation: spin 1s infinite; margin-bottom: 20px; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* Home Header */
        .home-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .welcome-text p { margin: 0; color: #94a3b8; font-size: 0.9em; }
        .welcome-text h2 { margin: 0; color: #f8fafc; font-size: 1.4em; }
        .header-actions { display: flex; gap: 10px; }
        
        .icon-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 10px; border-radius: 12px; cursor: pointer; display: flex; alignItems: center; justify-content: center; transition: all 0.2s; }
        .icon-btn:active { background: #334155; color: #38bdf8; }
        .icon-btn.store { color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }

        /* Store Banner */
        .store-banner { background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 16px; padding: 20px; color: white; display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 30px; box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3); transition: transform 0.2s; }
        .store-banner:active { transform: scale(0.98); }
        .banner-content h3 { margin: 0 0 5px; font-size: 1.2em; }
        .banner-content p { margin: 0; opacity: 0.9; font-size: 0.9em; }
        .banner-arrow { font-size: 1.5em; background: rgba(255,255,255,0.2); width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; border-radius: 50%; }

        /* Subjects Grid */
        .section-head { color: #cbd5e1; font-size: 1.1em; margin-bottom: 15px; border-right: 4px solid #38bdf8; padding-right: 10px; }
        .subjects-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .subject-card { background: #1e293b; padding: 20px; border-radius: 16px; border: 1px solid #334155; cursor: pointer; transition: 0.2s; text-align: center; }
        .subject-card:active { background: #334155; transform: scale(0.98); }
        .sub-icon { font-size: 2.5em; margin-bottom: 10px; }
        .sub-details h4 { margin: 0 0 5px; color: #e2e8f0; }
        .sub-details span { font-size: 0.8em; color: #94a3b8; }

        /* Empty State */
        .empty-home { text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed #334155; }
        .ghost-icon { font-size: 3em; margin-bottom: 10px; opacity: 0.5; }
        .subscribe-now-btn { margin-top: 15px; background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }

        /* Inner Pages Common */
        .nav-back { background: transparent; border: none; color: #94a3b8; font-size: 0.95em; cursor: pointer; display: block; margin-bottom: 15px; font-weight: bold; }
        .nav-back.sticky { position: sticky; top: 0; background: #0f172a; width: 100%; text-align: right; padding: 10px 0; z-index: 10; border-bottom: 1px solid #1e293b; }
        
        .mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
        .mode-card { background: #1e293b; padding: 30px 20px; border-radius: 20px; text-align: center; border: 1px solid #334155; cursor: pointer; transition: 0.2s; }
        .mode-card:active { transform: scale(0.98); }
        .mode-card.lectures:hover { border-color: #38bdf8; } .mode-card.exams:hover { border-color: #f472b6; }
        .mode-card .icon { font-size: 3em; margin-bottom: 15px; }
        .mode-card h3 { margin: 0; color: white; }
        .mode-card p { color: #94a3b8; margin: 5px 0 0; font-size: 0.9em; }

        /* Lists */
        .animated-list > div { animation: slideUp 0.3s ease forwards; opacity: 0; transform: translateY(10px); }
        .animated-list > div:nth-child(1) { animation-delay: 0s; }
        .animated-list > div:nth-child(2) { animation-delay: 0.05s; }
        .animated-list > div:nth-child(3) { animation-delay: 0.1s; }
        
        .chapter-card { background: #1e293b; padding: 15px; margin-bottom: 12px; border-radius: 12px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-left: 4px solid #38bdf8; }
        .ch-icon { font-size: 1.5em; }
        .ch-info h3 { margin: 0; font-size: 1em; }
        .ch-info span { font-size: 0.8em; color: #94a3b8; }
        .arrow { margin-right: auto; color: #64748b; }

        .exam-card { background: #1e293b; padding: 15px; margin-bottom: 12px; border-radius: 12px; display: flex; align-items: center; gap: 15px; cursor: pointer; border: 1px solid #334155; }
        .exam-card.completed { border-color: #22c55e; background: rgba(34, 197, 94, 0.05); }
        .ex-icon { font-size: 1.5em; }
        .ex-info h3 { margin: 0; font-size: 1em; }
        .ex-info span { font-size: 0.8em; color: #94a3b8; }
        
        /* Content Page */
        .tabs-container { display: flex; background: #1e293b; padding: 5px; border-radius: 12px; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 10px; border: none; background: transparent; color: #94a3b8; cursor: pointer; border-radius: 8px; font-weight: bold; transition: 0.2s; }
        .tab-btn.active { background: #38bdf8; color: #0f172a; shadow: 0 2px 10px rgba(56, 189, 248, 0.3); }
        
        .content-card { background: #1e293b; padding: 15px; margin-bottom: 10px; border-radius: 10px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
        .content-card:hover { background: #334155; }
        .content-card .icon { font-size: 1.2em; }
        .content-card.video { border-right: 4px solid #f472b6; }
        .content-card.pdf { border-right: 4px solid #ef4444; }
        
        .empty-state { text-align: center; color: #64748b; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 8px; }
        .developer-info { text-align: center; margin-top: 40px; color: #475569; font-size: 0.8em; border-top: 1px solid #1e293b; padding-top: 20px; }

        @keyframes slideUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
