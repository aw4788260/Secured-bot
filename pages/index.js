import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();
  
  const [status, setStatus] = useState('جار تحميل المكتبة...');
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  
  // حالات التنقل داخل الصفحة (SPA feel)
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [mode, setMode] = useState(null); // 'lectures' or 'exams'
  
  // بيانات المستخدم
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('videos'); 

  useEffect(() => { setActiveTab('videos'); }, [selectedChapter]);

  // --- دالة الطرد الآمن ---
  const forceLogout = () => {
      localStorage.removeItem('auth_user_id');
      localStorage.removeItem('auth_first_name');
      document.cookie = "student_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
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
        if (err.message === "SESSION_EXPIRED" || err.message.includes("رفض")) forceLogout();
        else setError("خطأ في الاتصال. تأكد من الإنترنت.");
    });

    // فحص الأدمن
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


  // ==========================================
  // واجهة المستخدم (Professional Dark UI)
  // ==========================================

  if (error) return (
    <div className="error-screen">
        <div className="icon-box error-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
        <h3>تنبيه أمني</h3>
        <p>{error}</p>
        {!error.includes("غير مسموح") && <button className="btn-primary" onClick={forceLogout}>تسجيل الدخول مجدداً</button>}
        <style jsx>{`
            .error-screen { height: 100vh; display: flex; flex-direction: column; justify-content: center; alignItems: center; background: #0f172a; color: white; padding: 20px; text-align: center; }
            .icon-box { margin-bottom: 20px; color: #ef4444; }
            h3 { font-size: 1.5rem; margin-bottom: 10px; }
            p { color: #94a3b8; margin-bottom: 30px; }
            .btn-primary { background: #38bdf8; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; color: #0f172a; cursor: pointer; }
        `}</style>
    </div>
  );

  if (status || !user) return (
    <div className="loading-screen">
        <div className="spinner"></div>
        <p>{status}</p>
        <style jsx>{`
            .loading-screen { height: 100vh; display: flex; flex-direction: column; justify-content: center; alignItems: center; background: #0f172a; color: #38bdf8; }
            .spinner { width: 40px; height: 40px; border: 3px solid #1e293b; border-top: 3px solid #38bdf8; border-radius: 50%; animation: spin 1s infinite; margin-bottom: 20px; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
    </div>
  );

  // 1. عرض المحتوى (فيديوهات / ملفات) [Level 4]
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        
        <header className="sticky-header">
            <button className="icon-btn" onClick={() => setSelectedChapter(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="header-title">{selectedChapter.title}</h2>
        </header>

        <div className="tabs-wrapper">
            <button onClick={() => setActiveTab('videos')} className={`tab ${activeTab === 'videos' ? 'active' : ''}`}>
                فيديوهات
            </button>
            <button onClick={() => setActiveTab('pdfs')} className={`tab ${activeTab === 'pdfs' ? 'active' : ''}`}>
                ملفات PDF
            </button>
        </div>

        <div className="content-list">
          {activeTab === 'videos' && (
            selectedChapter.videos.length > 0 ? selectedChapter.videos.map(v => (
                <div key={v.id} className="content-item video" onClick={() => router.push(`/watch/${v.id}`)}>
                    <div className="icon-wrapper play">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div className="info">
                        <span className="title">{v.title}</span>
                        <span className="subtitle">فيديو تعليمي</span>
                    </div>
                    <div className="action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            )) : <div className="empty-msg">لا توجد فيديوهات في هذا القسم</div>
          )}

          {activeTab === 'pdfs' && (
            selectedChapter.pdfs?.length > 0 ? selectedChapter.pdfs.map(p => (
                <div key={p.id} className="content-item pdf" onClick={() => router.push(`/pdf-viewer/${p.id}?title=${encodeURIComponent(p.title)}`)}>
                    <div className="icon-wrapper doc">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div className="info">
                        <span className="title">{p.title}</span>
                        <span className="subtitle">مذكرة PDF</span>
                    </div>
                    <div className="action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            )) : <div className="empty-msg">لا توجد ملفات</div>
          )}
        </div>
      </div>
    );
  }

  // 2. داخل المادة (اختيار القسم / قائمة الفصول / الامتحانات) [Level 2 & 3]
  if (selectedSubject) {
    // أ) القائمة الرئيسية للمادة
    if (mode === null) {
      return (
        <div className="app-container">
          <Head><title>{selectedSubject.title}</title></Head>
          <header className="sticky-header">
              <button className="icon-btn" onClick={() => setSelectedSubject(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <h1 className="header-title">{selectedSubject.title}</h1>
          </header>
          
          <div className="dashboard-grid">
              <div className="dash-card blue" onClick={() => setMode('lectures')}>
                  <div className="card-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                  </div>
                  <h3>المحتوى الدراسي</h3>
                  <p>{selectedSubject.chapters.length} فصل</p>
              </div>
              <div className="dash-card pink" onClick={() => setMode('exams')}>
                  <div className="card-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <h3>الامتحانات</h3>
                  <p>{selectedSubject.exams?.length || 0} امتحان</p>
              </div>
          </div>
        </div>
      );
    }
    
    // ب) قائمة الفصول
    if (mode === 'lectures') {
      return (
        <div className="app-container">
          <header className="sticky-header">
              <button className="icon-btn" onClick={() => setMode(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <h2 className="header-title">فصول المادة</h2>
          </header>
          <div className="content-list">
            {selectedSubject.chapters.map(ch => (
                <div key={ch.id} className="content-item chapter" onClick={() => setSelectedChapter(ch)}>
                    <div className="icon-wrapper folder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div className="info">
                        <span className="title">{ch.title}</span>
                        <span className="subtitle">{ch.videos.length} فيديو</span>
                    </div>
                    <div className="action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            ))}
          </div>
        </div>
      );
    }

    // ج) قائمة الامتحانات
    if (mode === 'exams') {
      return (
        <div className="app-container">
          <header className="sticky-header">
              <button className="icon-btn" onClick={() => setMode(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <h2 className="header-title">الامتحانات</h2>
          </header>
          <div className="content-list">
            {selectedSubject.exams?.map(ex => (
                <div key={ex.id} className="content-item exam" onClick={() => router.push(!ex.is_completed ? `/exam/${ex.id}` : `/results/${ex.first_attempt_id}`)}>
                    <div className={`icon-wrapper ${ex.is_completed ? 'success' : 'pending'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div className="info">
                        <span className="title">{ex.title}</span>
                        <span className={`subtitle ${ex.is_completed ? 'text-green' : ''}`}>
                            {ex.is_completed ? '✅ تم الحل (النتيجة)' : 'ابدأ الآن'}
                        </span>
                    </div>
                    <div className="action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // 3. الصفحة الرئيسية (مكتبة الطالب) [Level 1]
  return (
    <div className="app-container">
      <Head><title>مكتبتي</title></Head>
      
      <header className="main-header">
          <div className="welcome">
              <span className="greet">أهلاً بك 👋</span>
              <h1 className="username">{user?.first_name}</h1>
          </div>
          <div className="header-controls">
              {/* زر المتجر (مخفي وأنيق) */}
              <button className="icon-btn store" onClick={() => router.push('/student/courses')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </button>
              {isAdmin && (
                  <button className="icon-btn" onClick={() => router.push('/admin')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
              )}
          </div>
      </header>

      <div className="section-header">
          <h3>موادي التعليمية</h3>
      </div>

      <div className="library-grid">
          {subjects.length > 0 ? (
              subjects.map(sub => (
                  <div key={sub.id} className="lib-card" onClick={() => { setSelectedSubject(sub); setMode(null); }}>
                      <div className="card-bg-icon"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></div>
                      <div className="card-info">
                          <h4>{sub.title}</h4>
                          <span>{sub.chapters.length} وحدات</span>
                      </div>
                  </div>
              ))
          ) : (
              <div className="empty-library">
                  <p>لا توجد مواد في مكتبتك.</p>
                  <button onClick={() => router.push('/student/courses')}>تصفح الكورسات</button>
              </div>
          )}
      </div>

      <style jsx global>{`
        /* Reset */
        body { margin: 0; background-color: #0f172a; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-tap-highlight-color: transparent; }
        .app-container { max-width: 600px; margin: 0 auto; min-height: 100vh; background: #0f172a; display: flex; flex-direction: column; }

        /* Headers */
        .main-header { padding: 25px 20px; display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); }
        .welcome .greet { font-size: 0.9rem; color: #94a3b8; display: block; margin-bottom: 5px; }
        .welcome .username { font-size: 1.5rem; margin: 0; font-weight: 700; color: white; }
        .header-controls { display: flex; gap: 10px; }
        
        .sticky-header { position: sticky; top: 0; z-index: 10; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); padding: 15px 20px; display: flex; align-items: center; border-bottom: 1px solid #1e293b; gap: 15px; }
        .header-title { font-size: 1.1rem; margin: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .icon-btn { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .icon-btn:active { transform: scale(0.95); background: #334155; }
        .icon-btn.store { color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }

        /* Library Grid */
        .section-header { padding: 0 20px; margin-bottom: 15px; }
        .section-header h3 { font-size: 1.1rem; color: #cbd5e1; margin: 0; border-right: 3px solid #38bdf8; padding-right: 10px; }
        
        .library-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding: 0 20px 40px; }
        .lib-card { background: #1e293b; border-radius: 16px; height: 140px; position: relative; overflow: hidden; border: 1px solid #334155; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .lib-card:active { transform: scale(0.98); border-color: #38bdf8; }
        .card-bg-icon { position: absolute; right: -20px; bottom: -20px; opacity: 0.05; color: white; transform: rotate(-15deg); }
        .card-info { position: absolute; bottom: 15px; right: 15px; z-index: 1; }
        .card-info h4 { margin: 0 0 5px; font-size: 1rem; color: #f1f5f9; }
        .card-info span { font-size: 0.8rem; color: #94a3b8; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 6px; }

        .empty-library { grid-column: span 2; text-align: center; padding: 40px; color: #64748b; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed #334155; }
        .empty-library button { margin-top: 15px; background: #38bdf8; border: none; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }

        /* Dashboard Grid (Level 2) */
        .dashboard-grid { display: grid; gap: 15px; padding: 20px; }
        .dash-card { background: #1e293b; padding: 25px; border-radius: 16px; border: 1px solid #334155; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .dash-card:active { background: #252f45; border-color: #38bdf8; }
        .dash-card .card-icon { padding: 15px; border-radius: 50%; margin-bottom: 5px; }
        .dash-card.blue .card-icon { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .dash-card.pink .card-icon { background: rgba(244, 114, 182, 0.1); color: #f472b6; }
        .dash-card h3 { margin: 0; font-size: 1.1rem; }
        .dash-card p { margin: 0; font-size: 0.9rem; color: #94a3b8; }

        /* Lists (Level 3 & 4) */
        .content-list { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
        .content-item { background: #1e293b; padding: 15px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid #334155; cursor: pointer; transition: 0.1s; }
        .content-item:active { background: #2a354b; border-color: #475569; }
        
        .icon-wrapper { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .icon-wrapper.folder { background: rgba(99, 102, 241, 0.1); color: #818cf8; }
        .icon-wrapper.play { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .icon-wrapper.doc { background: rgba(244, 114, 182, 0.1); color: #f472b6; }
        .icon-wrapper.success { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
        .icon-wrapper.pending { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }

        .info { flex: 1; overflow: hidden; }
        .info .title { display: block; font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .info .subtitle { display: block; font-size: 0.8rem; color: #94a3b8; }
        .text-green { color: #4ade80 !important; }
        
        .action-icon { color: #475569; }

        /* Tabs */
        .tabs-wrapper { display: flex; gap: 10px; padding: 15px 20px 0; background: #0f172a; position: sticky; top: 70px; z-index: 5; border-bottom: 1px solid #1e293b; }
        .tab { flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 3px solid transparent; color: #94a3b8; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .tab.active { color: #38bdf8; border-bottom-color: #38bdf8; }

        .empty-msg { text-align: center; color: #64748b; padding: 40px 0; font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
