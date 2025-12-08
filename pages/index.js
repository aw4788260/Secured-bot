import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();
  
  const [status, setStatus] = useState('جار فحص البيانات وتجهيز المكتبة...');
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  
  // Navigation States
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  
  // Tabs States
  const [subjectTab, setSubjectTab] = useState('lectures'); 
  const [chapterTab, setChapterTab] = useState('videos');   
  
  // User Data
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Reset tabs
  useEffect(() => { setSubjectTab('lectures'); }, [selectedSubject]);
  useEffect(() => { setChapterTab('videos'); }, [selectedChapter]);

  // ---------------------------------------------------------
  // Logic
  // ---------------------------------------------------------
  const forceLogout = () => {
      localStorage.removeItem('auth_user_id');
      localStorage.removeItem('auth_first_name');
      document.cookie = "student_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      router.replace('/login');
  };

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

  useEffect(() => {
    checkAndTriggerUpdate();
    const uid = localStorage.getItem('auth_user_id');
    const did = localStorage.getItem('auth_device_id');
    const fname = localStorage.getItem('auth_first_name');

    if (!uid || !did) { forceLogout(); return; }
    setUser({ id: uid, first_name: fname });

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
        if (err.message === "SESSION_EXPIRED" || err.message.includes("رفض")) forceLogout();
        else setError("حدث خطأ في الاتصال. تأكد من الإنترنت.");
    });

    fetch('/api/auth/check-admin', { headers: { 'x-user-id': uid, 'x-device-id': did } })
    .then(r=>r.json()).then(d=> { 
        if(d.isAdmin) setIsAdmin(true); 
        if (typeof window !== 'undefined') {
            const ua = window.navigator.userAgent.toLowerCase();
            const isIos = /iphone|ipad|ipod/.test(ua);
            const isAndroidApp = typeof window.Android !== 'undefined';
            if (!d.isAdmin && !isIos && !isAndroidApp) {
                setError("⛔ غير مسموح بالدخول من المتصفح. استخدم التطبيق الرسمي.");
                setStatus(null);
            }
        }
    }).catch(() => {});
  }, []);

  // ---------------------------------------------------------
  // UI Render
  // ---------------------------------------------------------

  if (error) return (
    <div className="center-fixed">
        <div className="icon-error">⚠️</div>
        <h3>تنبيه</h3>
        <p>{error}</p>
        {!error.includes("غير مسموح") && <button className="btn-action" onClick={forceLogout}>إعادة المحاولة</button>}
        <style jsx>{`
            .center-fixed { position: fixed; top: 0; left: 0; width: 100%; height: 100vh; display: flex; flex-direction: column; justify-content: center; alignItems: center; text-align: center; color: white; background: #0f172a; z-index: 9999; padding: 20px; }
            .icon-error { font-size: 3rem; margin-bottom: 10px; }
            h3 { color: #ef4444; margin: 0 0 10px; font-size: 1.5rem; }
            p { color: #cbd5e1; margin-bottom: 20px; }
            .btn-action { background: #334155; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        `}</style>
    </div>
  );

if (status || !user) return (
    <div className="center-fixed">
        <div className="spinner"></div>
        <p className="loading-text">{status}</p>
        <style jsx>{`
            .center-fixed { 
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100vh; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
                align-items: center; /* تم التصحيح هنا */
                background: #0f172a; 
                z-index: 9999; 
            }
            .loading-text {
                margin-top: 20px;
                color: #38bdf8;
                font-weight: 500;
                font-size: 1.1rem;
                text-align: center;
            }
            .spinner { 
                width: 50px; 
                height: 50px; 
                border: 4px solid #1e293b; 
                border-top: 4px solid #38bdf8; 
                border-radius: 50%; 
                animation: spin 1s infinite; 
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
    </div>
  );

  // 🔴 المستوى 3: عرض الفصل
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        
        <header className="page-header sticky">
            <button className="icon-btn back" onClick={() => setSelectedChapter(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="header-title">{selectedChapter.title}</h2>
        </header>

        <div className="tabs-container">
            <button onClick={() => setChapterTab('videos')} className={`tab ${chapterTab === 'videos' ? 'active' : ''}`}>
                فيديوهات 🎬
            </button>
            <button onClick={() => setChapterTab('pdfs')} className={`tab ${chapterTab === 'pdfs' ? 'active' : ''}`}>
                ملفات PDF 📄
            </button>
        </div>

        <div className="content-area">
          {chapterTab === 'videos' && (
            selectedChapter.videos.length > 0 ? selectedChapter.videos.map(v => (
                <div key={v.id} className="modern-card video-card" onClick={() => router.push(`/watch/${v.id}`)}>
                    <div className="card-icon play">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div className="card-info">
                        <h3>{v.title}</h3>
                        <span>اضغط للمشاهدة</span>
                    </div>
                    <div className="arrow-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            )) : <div className="empty-state">لا توجد فيديوهات</div>
          )}

          {chapterTab === 'pdfs' && (
            selectedChapter.pdfs?.length > 0 ? selectedChapter.pdfs.map(p => (
                <div key={p.id} className="modern-card pdf-card" onClick={() => router.push(`/pdf-viewer/${p.id}?title=${encodeURIComponent(p.title)}`)}>
                    <div className="card-icon doc">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div className="card-info">
                        <h3>{p.title}</h3>
                        <span>ملف PDF</span>
                    </div>
                    <div className="arrow-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            )) : <div className="empty-state">لا توجد ملفات</div>
          )}
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  // 🟠 المستوى 2: داخل المادة
  if (selectedSubject) {
    return (
      <div className="app-container">
        <Head><title>{selectedSubject.title}</title></Head>
        
        <header className="page-header sticky">
            <button className="icon-btn back" onClick={() => setSelectedSubject(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h1 className="header-title">{selectedSubject.title}</h1>
        </header>

        <div className="tabs-container">
            <button onClick={() => setSubjectTab('lectures')} className={`tab ${subjectTab === 'lectures' ? 'active' : ''}`}>
                الفصول الدراسية 📁
            </button>
            <button onClick={() => setSubjectTab('exams')} className={`tab ${subjectTab === 'exams' ? 'active' : ''}`}>
                الامتحانات 📝
            </button>
        </div>

        <div className="content-area">
            {subjectTab === 'lectures' && (
                <div className="grid-list">
                    {selectedSubject.chapters.map(ch => (
                        <div key={ch.id} className="modern-card chapter-card" onClick={() => setSelectedChapter(ch)}>
                            <div className="card-icon folder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <div className="card-info">
                                <h3>{ch.title}</h3>
                                <span>{ch.videos.length} فيديو</span>
                            </div>
                            <div className="arrow-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                        </div>
                    ))}
                    {selectedSubject.chapters.length === 0 && <div className="empty-state">لا توجد فصول مضافة</div>}
                </div>
            )}

            {subjectTab === 'exams' && (
                <div className="grid-list">
                    {selectedSubject.exams?.map(ex => (
                        <div key={ex.id} className="modern-card exam-card" onClick={() => router.push(!ex.is_completed ? `/exam/${ex.id}` : `/results/${ex.first_attempt_id}`)}>
                            <div className={`card-icon ${ex.is_completed ? 'success' : 'pending'}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div className="card-info">
                                <h3>{ex.title}</h3>
                                <span className={ex.is_completed ? 'status-green' : 'status-orange'}>
                                    {ex.is_completed ? 'تم الحل (عرض النتيجة)' : 'ابدأ الآن'}
                                </span>
                            </div>
                            <div className="arrow-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                        </div>
                    ))}
                    {(!selectedSubject.exams || selectedSubject.exams.length === 0) && <div className="empty-state">لا توجد امتحانات</div>}
                </div>
            )}
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  // 🟢 المستوى 1: الصفحة الرئيسية (مكتبتي)
  return (
    <div className="app-container">
      <Head><title>مكتبتي</title></Head>
      
      <header className="main-header">
          <div className="welcome">
              <span className="greet">أهلاً بك 👋</span>
              <h1 className="username">{user?.first_name}</h1>
          </div>
          <div className="header-controls">
              {/* زر المتجر (سلة) */}
              <button className="icon-btn store" onClick={() => router.push('/student/courses')} title="متجر الكورسات">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </button>
              {isAdmin && (
                  <button className="icon-btn" onClick={() => router.push('/admin')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
              )}
          </div>
      </header>

      {/* تم إزالة بانر المتجر الكبير هنا */}

      <h3 className="section-head">مكتبتي التعليمية</h3>

      <div className="library-grid">
        {subjects.length > 0 ? (
           subjects.map(subject => (
            <div key={subject.id} className="modern-card subject-card" onClick={() => { setSelectedSubject(subject); setMode(null); }}>
                <div className="card-icon book">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                </div>
                <div className="card-info">
                    <h3>{subject.title}</h3>
                    <span>{subject.chapters.length} وحدة دراسية</span>
                </div>
                <div className="arrow-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
            </div>
           ))
        ) : (
           <div className="empty-state">
               <p>لا توجد مواد مشتركة حالياً.</p>
               <button className="btn-small" onClick={() => router.push('/student/courses')}>تصفح المتجر</button>
           </div>
        )}
      </div>
      
      <footer className="developer-info">
         <p>برمجة وتطوير: A7MeD WaLiD</p>
      </footer>
      <style jsx global>{styles}</style>
    </div>
  );
}

// ============================================
// CSS Styles
// ============================================
const styles = `
  body { margin: 0; background: #0f172a; color: white; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-tap-highlight-color: transparent; }
  .app-container { min-height: 100vh; padding: 20px; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; }
  
  /* Header */
  .main-header { padding: 10px 0 20px; display: flex; justify-content: space-between; align-items: center; }
  .welcome .greet { font-size: 0.9em; color: #94a3b8; display: block; margin-bottom: 2px; }
  .welcome .username { font-size: 1.4em; margin: 0; color: #f8fafc; font-weight: 700; }
  .header-controls { display: flex; gap: 10px; }
  
  .modern-header {
      padding: 15px 20px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px);
      display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #1e293b;
      position: sticky; top: 0; z-index: 10; margin: 0 -20px;
  }
  .header-title { margin: 0; font-size: 1.1rem; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  
  .icon-btn {
      background: #1e293b; border: 1px solid #334155; color: #cbd5e1; width: 40px; height: 40px;
      border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;
  }
  .icon-btn:active { background: #334155; color: #38bdf8; }
  .icon-btn.store { color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }

  /* Tabs */
  .tabs-container {
      display: flex; gap: 10px; padding: 15px 20px; background: #0f172a;
      position: sticky; top: 70px; z-index: 5; border-bottom: 1px solid #1e293b; margin: 0 -20px;
  }
  .tab {
      flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 3px solid transparent;
      color: #94a3b8; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.95rem;
  }
  .tab.active { color: #38bdf8; border-bottom-color: #38bdf8; background: rgba(56, 189, 248, 0.05); }

  /* Cards & Grid */
  .section-head { margin: 0 0 15px; color: #cbd5e1; font-size: 1.1em; border-right: 4px solid #38bdf8; padding-right: 10px; }
  .library-grid, .grid-list { display: flex; flex-direction: column; gap: 15px; }
  .content-area { padding: 20px 0; }

  .modern-card {
      background: #1e293b; padding: 18px; border-radius: 16px; display: flex; align-items: center; gap: 15px;
      border: 1px solid #334155; cursor: pointer; transition: transform 0.1s; position: relative; overflow: hidden;
  }
  .modern-card:active { transform: scale(0.98); border-color: #38bdf8; background: #252f45; }
  
  .card-icon {
      width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .card-icon.book { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
  .card-icon.folder { background: rgba(99, 102, 241, 0.1); color: #818cf8; }
  .card-icon.play { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
  .card-icon.doc { background: rgba(244, 114, 182, 0.1); color: #f472b6; }
  .card-icon.success { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
  .card-icon.pending { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }

  .card-info { flex: 1; overflow: hidden; }
  .card-info h3 { margin: 0 0 6px; font-size: 1.05rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-info span { font-size: 0.85rem; color: #94a3b8; }
  
  .status-green { color: #4ade80; font-size: 0.8rem; font-weight: bold; }
  .status-orange { color: #fbbf24; font-size: 0.8rem; }
  .arrow-icon { color: #475569; }
  
  .developer-info { text-align: center; margin-top: 40px; color: #64748b; font-size: 0.9em; border-top: 1px solid #334155; padding-top: 20px; }
  .developer-info a { color: #38bdf8; text-decoration: none; }
  
  .empty-state { text-align: center; color: #64748b; padding: 40px 0; font-size: 0.9rem; background: rgba(255,255,255,0.02); border-radius: 12px; }
  .btn-small { background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; margin-top: 10px; cursor: pointer; }
`;
