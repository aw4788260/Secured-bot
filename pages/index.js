import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();
  
  const [status, setStatus] = useState('جار تحميل المكتبة...');
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

  // ---------------------------------------------------------
  // نفس منطق التحديث والتحقق (لم يتم تغييره لضمان العمل)
  // ---------------------------------------------------------
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

    if (!uid || !did) { router.replace('/login'); return; }
    setUser({ id: uid, first_name: fname });

    fetch('/api/data/get-structured-courses', { headers: { 'x-user-id': uid, 'x-device-id': did } })
    .then(res => { if (res.status === 403) throw new Error("تم رفض الوصول"); return res.json(); })
    .then(data => { setSubjects(data); setStatus(null); })
    .catch(err => { setError(err.message); if(err.message.includes("رفض")) router.replace('/login'); });

    fetch('/api/auth/check-admin', { headers: { 'x-user-id': uid, 'x-device-id': did } })
    .then(r=>r.json()).then(d=> { if(d.isAdmin) setIsAdmin(true); });
  }, []);

  // ---------------------------------------------------------
  // واجهة المستخدم الجديدة (Professional UI)
  // ---------------------------------------------------------

  if (error) return <div className="center-screen error"><p>{error}</p></div>;
  if (status) return <div className="center-screen loading"><div className="spinner"></div><p>{status}</p></div>;

  // 1. عرض المحتوى (فيديوهات / ملفات)
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        
        {/* Header */}
        <header className="page-header">
            <button className="icon-btn back" onClick={() => setSelectedChapter(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="header-title">{selectedChapter.title}</h2>
        </header>

        {/* Tabs */}
        <div className="modern-tabs">
            <button onClick={() => setActiveTab('videos')} className={`tab ${activeTab === 'videos' ? 'active' : ''}`}>
                فيديوهات
            </button>
            <button onClick={() => setActiveTab('pdfs')} className={`tab ${activeTab === 'pdfs' ? 'active' : ''}`}>
                ملفات PDF
            </button>
        </div>

        {/* Content List */}
        <div className="content-stream">
          {activeTab === 'videos' && (
            selectedChapter.videos.length > 0 ? selectedChapter.videos.map(v => (
                <div key={v.id} className="media-row" onClick={() => router.push(`/watch/${v.id}`)}>
                    <div className="media-icon play">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div className="media-info">
                        <span className="media-title">{v.title}</span>
                        <span className="media-type">فيديو</span>
                    </div>
                </div>
            )) : <div className="empty-state">لا يوجد محتوى فيديو</div>
          )}

          {activeTab === 'pdfs' && (
            selectedChapter.pdfs?.length > 0 ? selectedChapter.pdfs.map(p => (
                <div key={p.id} className="media-row" onClick={() => router.push(`/pdf-viewer/${p.id}?title=${encodeURIComponent(p.title)}`)}>
                    <div className="media-icon doc">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div className="media-info">
                        <span className="media-title">{p.title}</span>
                        <span className="media-type">ملف PDF</span>
                    </div>
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
          <header className="page-header">
              <button className="icon-btn back" onClick={() => setSelectedSubject(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <h1 className="header-title">{selectedSubject.title}</h1>
          </header>
          
          <div className="cards-grid">
              <div className="action-card" onClick={() => setMode('lectures')}>
                  <div className="card-icon">
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                  </div>
                  <h3>المحتوى الدراسي</h3>
                  <p>{selectedSubject.chapters.length} فصل</p>
              </div>
              <div className="action-card" onClick={() => setMode('exams')}>
                  <div className="card-icon">
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <h3>الامتحانات</h3>
                  <p>{selectedSubject.exams?.length || 0} امتحان</p>
              </div>
          </div>
        </div>
      );
    }
    
    // قائمة الشباتر
    if (mode === 'lectures') {
      return (
        <div className="app-container">
          <header className="page-header">
              <button className="icon-btn back" onClick={() => setMode(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <h2 className="header-title">الفصول</h2>
          </header>
          <div className="list-container">
            {selectedSubject.chapters.map(ch => (
                <div key={ch.id} className="list-item" onClick={() => setSelectedChapter(ch)}>
                    <div className="item-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div className="item-content">
                        <h3>{ch.title}</h3>
                        <span>{ch.videos.length} فيديو</span>
                    </div>
                    <div className="item-arrow">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                    </div>
                </div>
            ))}
          </div>
        </div>
      );
    }

    // قائمة الامتحانات
    if (mode === 'exams') {
      return (
        <div className="app-container">
          <header className="page-header">
              <button className="icon-btn back" onClick={() => setMode(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <h2 className="header-title">الامتحانات</h2>
          </header>
          <div className="list-container">
            {selectedSubject.exams?.map(ex => (
                <div key={ex.id} className="list-item" onClick={() => router.push(!ex.is_completed ? `/exam/${ex.id}` : `/results/${ex.first_attempt_id}`)}>
                    <div className={`item-icon ${ex.is_completed ? 'success' : ''}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div className="item-content">
                        <h3>{ex.title}</h3>
                        <span className={ex.is_completed ? 'text-success' : ''}>{ex.is_completed ? 'تم الحل (النتيجة)' : 'غير مكتمل'}</span>
                    </div>
                </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // 3. الصفحة الرئيسية (مكتبة الطالب)
  return (
    <div className="app-container home-layout">
      <Head><title>مكتبتي</title></Head>
      
      {/* Header */}
      <header className="main-app-bar">
          <div className="user-greet">
              <h1>مرحباً، {user?.first_name}</h1>
          </div>
          <div className="header-actions">
              {/* زر المتجر المخفي (أيقونة فقط) */}
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

      {/* Library Grid */}
      <main className="library-grid">
          {subjects.length > 0 ? (
              subjects.map(sub => (
                  <div key={sub.id} className="library-card" onClick={() => { setSelectedSubject(sub); setMode(null); }}>
                      <div className="card-top">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      </div>
                      <div className="card-bottom">
                          <h3>{sub.title}</h3>
                          <span className="meta">{sub.chapters.length} وحدة دراسية</span>
                      </div>
                  </div>
              ))
          ) : (
              <div className="empty-placeholder">
                  <p>لا توجد مواد مشتركة. اضغط على أيقونة المتجر بالأعلى.</p>
              </div>
          )}
      </main>

      <style jsx global>{`
        /* --- General Reset --- */
        body { margin: 0; background-color: #0f172a; color: #f1f5f9; font-family: 'Segoe UI', Tahoma, sans-serif; -webkit-tap-highlight-color: transparent; }
        .app-container { min-height: 100vh; max-width: 600px; margin: 0 auto; background: #0f172a; display: flex; flex-direction: column; }
        
        /* --- Utility Classes --- */
        .center-screen { height: 100vh; display: flex; flex-direction: column; justify-content: center; alignItems: center; text-align: center; }
        .loading .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top: 3px solid #38bdf8; border-radius: 50%; animation: spin 1s infinite; margin-bottom: 20px; }
        .error { color: #f87171; padding: 20px; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* --- Headers --- */
        .main-app-bar { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #0f172a; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #1e293b; }
        .user-greet h1 { font-size: 1.25rem; margin: 0; font-weight: 700; color: #f8fafc; }
        
        .page-header { display: flex; alignItems: center; padding: 15px 20px; background: #0f172a; border-bottom: 1px solid #1e293b; position: sticky; top: 0; z-index: 10; gap: 15px; }
        .header-title { font-size: 1.1rem; margin: 0; font-weight: 600; color: #e2e8f0; flex: 1; }

        .icon-btn { background: transparent; border: none; color: #94a3b8; padding: 8px; border-radius: 50%; cursor: pointer; display: flex; alignItems: center; justify-content: center; transition: all 0.2s; }
        .icon-btn:active { background: #1e293b; color: #38bdf8; }
        .icon-btn.store { color: #38bdf8; } 

        /* --- Home: Library Grid --- */
        .library-grid { padding: 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .library-card { background: #1e293b; border-radius: 16px; padding: 20px; border: 1px solid #334155; cursor: pointer; transition: transform 0.1s; display: flex; flex-direction: column; justify-content: space-between; min-height: 120px; }
        .library-card:active { transform: scale(0.98); background: #334155; }
        .card-top { color: #38bdf8; margin-bottom: 15px; }
        .card-bottom h3 { margin: 0 0 5px; font-size: 1rem; color: #f8fafc; }
        .card-bottom .meta { font-size: 0.8rem; color: #94a3b8; }

        .empty-placeholder { grid-column: span 2; text-align: center; color: #64748b; padding: 40px 0; font-size: 0.9rem; }

        /* --- Level 2: Subject Modes --- */
        .cards-grid { padding: 20px; display: grid; gap: 15px; }
        .action-card { background: #1e293b; padding: 25px; border-radius: 16px; border: 1px solid #334155; display: flex; flex-direction: column; alignItems: center; text-align: center; gap: 10px; cursor: pointer; }
        .action-card:active { background: #334155; border-color: #38bdf8; }
        .card-icon { color: #38bdf8; padding: 15px; background: rgba(56, 189, 248, 0.1); border-radius: 50%; }
        .action-card h3 { margin: 0; font-size: 1.1rem; }
        .action-card p { margin: 0; font-size: 0.85rem; color: #94a3b8; }

        /* --- Lists (Chapters & Exams) --- */
        .list-container { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .list-item { background: #1e293b; padding: 16px; border-radius: 12px; display: flex; alignItems: center; gap: 15px; border: 1px solid #334155; cursor: pointer; }
        .list-item:active { border-color: #38bdf8; background: #252f45; }
        .item-icon { color: #94a3b8; }
        .item-icon.success { color: #22c55e; }
        .item-content { flex: 1; }
        .item-content h3 { margin: 0 0 4px; font-size: 1rem; color: #e2e8f0; }
        .item-content span { font-size: 0.8rem; color: #94a3b8; }
        .text-success { color: #4ade80 !important; }
        .item-arrow { color: #64748b; }

        /* --- Content View (Videos) --- */
        .modern-tabs { display: flex; padding: 15px 20px 0; gap: 10px; border-bottom: 1px solid #334155; background: #0f172a; position: sticky; top: 60px; z-index: 5; }
        .tab { flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 3px solid transparent; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.95rem; }
        .tab.active { color: #38bdf8; border-bottom-color: #38bdf8; }

        .content-stream { padding: 15px; }
        .media-row { display: flex; alignItems: center; gap: 15px; padding: 16px; border-bottom: 1px solid #1e293b; cursor: pointer; transition: background 0.1s; border-radius: 8px; }
        .media-row:active { background: #1e293b; }
        .media-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; alignItems: center; justify-content: center; flex-shrink: 0; }
        .media-icon.play { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .media-icon.doc { background: rgba(244, 114, 182, 0.1); color: #f472b6; }
        
        .media-info { display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
        .media-title { font-size: 0.95rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .media-type { font-size: 0.75rem; color: #64748b; }
        
        .empty-state { text-align: center; padding: 40px; color: #64748b; font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
