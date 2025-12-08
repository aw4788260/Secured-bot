import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();
  
  const [status, setStatus] = useState('جار تحميل مكتبتك...');
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  
  // بيانات التنقل
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  
  // إدارة التبويبات (Tabs Management)
  const [subjectTab, setSubjectTab] = useState('lectures'); // lectures | exams
  const [chapterTab, setChapterTab] = useState('videos');   // videos | pdfs
  
  // بيانات المستخدم
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // تصفير التبويبات عند التنقل
  useEffect(() => { setSubjectTab('lectures'); }, [selectedSubject]);
  useEffect(() => { setChapterTab('videos'); }, [selectedChapter]);

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
        else setError("حدث خطأ في الاتصال. تأكد من الإنترنت.");
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
  // واجهة المستخدم (Modern UI with Tabs)
  // ==========================================

  if (error) return <div className="center-screen error"><div className="icon-alert">⚠️</div><p>{error}</p>{!error.includes("غير مسموح") && <button className="btn-retry" onClick={forceLogout}>إعادة التسجيل</button>}</div>;
  if (status) return <div className="center-screen loading"><div className="spinner"></div><p>{status}</p></div>;

  // 🔴 المستوى 3: عرض الفصل (فيديوهات / ملفات)
  if (selectedSubject && selectedChapter) {
    return (
      <div className="app-container">
        <Head><title>{selectedChapter.title}</title></Head>
        
        {/* Header */}
        <header className="page-header sticky">
            <button className="icon-btn back" onClick={() => setSelectedChapter(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="header-title">{selectedChapter.title}</h2>
        </header>

        {/* Tabs */}
        <div className="tabs-container">
            <button onClick={() => setChapterTab('videos')} className={`tab ${chapterTab === 'videos' ? 'active' : ''}`}>
                <span className="tab-icon">📺</span> فيديوهات
            </button>
            <button onClick={() => setChapterTab('pdfs')} className={`tab ${chapterTab === 'pdfs' ? 'active' : ''}`}>
                <span className="tab-icon">📄</span> ملفات PDF
            </button>
        </div>

        {/* Content */}
        <div className="content-area">
          {chapterTab === 'videos' && (
            selectedChapter.videos.length > 0 ? selectedChapter.videos.map(v => (
                <div key={v.id} className="content-card video-card" onClick={() => router.push(`/watch/${v.id}`)}>
                    <div className="card-icon-box play">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div className="card-info">
                        <h3>{v.title}</h3>
                        <span>اضغط للمشاهدة</span>
                    </div>
                    <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            )) : <div className="empty-state">لا توجد فيديوهات متاحة</div>
          )}

          {chapterTab === 'pdfs' && (
            selectedChapter.pdfs?.length > 0 ? selectedChapter.pdfs.map(p => (
                <div key={p.id} className="content-card pdf-card" onClick={() => router.push(`/pdf-viewer/${p.id}?title=${encodeURIComponent(p.title)}`)}>
                    <div className="card-icon-box doc">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div className="card-info">
                        <h3>{p.title}</h3>
                        <span>ملف PDF</span>
                    </div>
                    <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                </div>
            )) : <div className="empty-state">لا توجد ملفات متاحة</div>
          )}
        </div>
      </div>
    );
  }

  // 🟠 المستوى 2: داخل المادة (فصول / امتحانات)
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

        {/* Subject Tabs */}
        <div className="tabs-container">
            <button onClick={() => setSubjectTab('lectures')} className={`tab ${subjectTab === 'lectures' ? 'active' : ''}`}>
                <span className="tab-icon">📂</span> الفصول الدراسية
            </button>
            <button onClick={() => setSubjectTab('exams')} className={`tab ${subjectTab === 'exams' ? 'active' : ''}`}>
                <span className="tab-icon">📝</span> الامتحانات
            </button>
        </div>

        <div className="content-area">
            {/* عرض الفصول */}
            {subjectTab === 'lectures' && (
                <div className="grid-list">
                    {selectedSubject.chapters.map(ch => (
                        <div key={ch.id} className="content-card chapter-card" onClick={() => setSelectedChapter(ch)}>
                            <div className="card-icon-box folder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <div className="card-info">
                                <h3>{ch.title}</h3>
                                <span>{ch.videos.length} فيديو</span>
                            </div>
                            <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                        </div>
                    ))}
                    {selectedSubject.chapters.length === 0 && <div className="empty-state">لا توجد فصول مضافة</div>}
                </div>
            )}

            {/* عرض الامتحانات */}
            {subjectTab === 'exams' && (
                <div className="grid-list">
                    {selectedSubject.exams?.map(ex => (
                        <div key={ex.id} className="content-card exam-card" onClick={() => router.push(!ex.is_completed ? `/exam/${ex.id}` : `/results/${ex.first_attempt_id}`)}>
                            <div className={`card-icon-box ${ex.is_completed ? 'success' : 'pending'}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div className="card-info">
                                <h3>{ex.title}</h3>
                                <span className={ex.is_completed ? 'status-green' : 'status-orange'}>
                                    {ex.is_completed ? 'تم الحل (عرض النتيجة)' : 'ابدأ الآن'}
                                </span>
                            </div>
                            <div className="card-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
                        </div>
                    ))}
                    {(!selectedSubject.exams || selectedSubject.exams.length === 0) && <div className="empty-state">لا توجد امتحانات</div>}
                </div>
            )}
        </div>
      </div>
    );
  }

  // 🟢 المستوى 1: الصفحة الرئيسية (مكتبة الطالب)
  return (
    <div className="app-container home-layout">
      <Head><title>مكتبتي التعليمية</title></Head>
      
      {/* Home Header */}
      <header className="main-header">
          <div className="welcome-box">
              <span className="greet">أهلاً بك 👋</span>
              <h1 className="username">{user?.first_name}</h1>
          </div>
          <div className="header-icons">
              {/* Store Button */}
              <button className="icon-btn store" onClick={() => router.push('/student/courses')} title="المتجر">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </button>
              {isAdmin && (
                  <button className="icon-btn" onClick={() => router.push('/admin')} title="لوحة التحكم">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
              )}
          </div>
      </header>

      <h3 className="section-title">موادي التعليمية</h3>

      <div className="library-grid">
          {subjects.length > 0 ? (
              subjects.map(sub => (
                  <div key={sub.id} className="subject-card" onClick={() => { setSelectedSubject(sub); setMode(null); }}>
                      <div className="sub-icon-box">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      </div>
                      <div className="sub-info">
                          <h4>{sub.title}</h4>
                          <span className="meta">{sub.chapters.length} وحدة</span>
                      </div>
                  </div>
              ))
          ) : (
              <div className="empty-home">
                  <div className="ghost">📭</div>
                  <p>لم تشترك في أي مواد بعد.</p>
                  <button onClick={() => router.push('/student/courses')}>تصفح الكورسات</button>
              </div>
          )}
      </div>

      <style jsx global>{`
        /* Reset & Base */
        body { margin: 0; background-color: #0f172a; color: #f8fafc; font-family: 'Segoe UI', Tahoma, sans-serif; -webkit-tap-highlight-color: transparent; }
        .app-container { min-height: 100vh; max-width: 600px; margin: 0 auto; background: #0f172a; display: flex; flex-direction: column; }
        
        /* Utility */
        .center-screen { height: 100vh; display: flex; flex-direction: column; justify-content: center; alignItems: center; text-align: center; }
        .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top: 3px solid #38bdf8; border-radius: 50%; animation: spin 1s infinite; margin-bottom: 20px; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .icon-alert { font-size: 2.5rem; margin-bottom: 10px; }
        .error { color: #f87171; }
        .btn-retry { margin-top: 15px; padding: 10px 20px; background: #334155; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }

        /* Headers */
        .main-header { padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); margin-bottom: 10px; }
        .welcome-box .greet { font-size: 0.9rem; color: #94a3b8; display: block; margin-bottom: 4px; }
        .welcome-box .username { font-size: 1.4rem; margin: 0; font-weight: 700; color: white; }
        .header-icons { display: flex; gap: 10px; }
        
        .sticky-header { position: sticky; top: 0; z-index: 10; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); padding: 15px 20px; display: flex; align-items: center; border-bottom: 1px solid #1e293b; gap: 15px; }
        .header-title { font-size: 1.1rem; margin: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }

        .icon-btn { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .icon-btn:active { transform: scale(0.95); background: #334155; }
        .icon-btn.store { color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }

        /* Tabs System */
        .tabs-container { display: flex; padding: 15px 20px 0; gap: 10px; background: #0f172a; position: sticky; top: 70px; z-index: 5; border-bottom: 1px solid #1e293b; }
        .tab { flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 3px solid transparent; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .tab:hover { background: rgba(255,255,255,0.02); }
        .tab.active { color: #38bdf8; border-bottom-color: #38bdf8; }
        .tab-icon { font-size: 1.1rem; }

        /* Content Lists (Cards) */
        .content-area { padding: 20px; }
        .grid-list { display: grid; gap: 12px; }
        
        .content-card { background: #1e293b; padding: 15px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid #334155; cursor: pointer; transition: transform 0.1s; position: relative; overflow: hidden; }
        .content-card:active { transform: scale(0.98); background: #252f45; border-color: #38bdf8; }
        
        .card-icon-box { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .card-icon-box.folder { background: rgba(99, 102, 241, 0.1); color: #818cf8; }
        .card-icon-box.play { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .card-icon-box.doc { background: rgba(244, 114, 182, 0.1); color: #f472b6; }
        .card-icon-box.success { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
        .card-icon-box.pending { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }

        .card-info { flex: 1; overflow: hidden; }
        .card-info h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-info span { font-size: 0.85rem; color: #94a3b8; }
        .status-green { color: #4ade80; font-weight: 500; font-size: 0.8rem; }
        .status-orange { color: #fbbf24; font-weight: 500; font-size: 0.8rem; }
        
        .card-arrow { color: #475569; }

        /* Home Subject Grid */
        .section-title { padding: 0 20px; font-size: 1.1rem; color: #cbd5e1; border-right: 3px solid #38bdf8; padding-right: 10px; margin-bottom: 15px; }
        .library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; padding: 0 20px 40px; }
        
        .subject-card { background: #1e293b; border-radius: 16px; padding: 20px; border: 1px solid #334155; cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 15px; }
        .subject-card:active { transform: scale(0.96); border-color: #38bdf8; }
        
        .sub-icon-box { width: 60px; height: 60px; background: rgba(56, 189, 248, 0.05); color: #38bdf8; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(56, 189, 248, 0.1); }
        .sub-info h4 { margin: 0 0 5px; font-size: 1rem; color: #f8fafc; }
        .sub-info .meta { font-size: 0.85rem; color: #94a3b8; background: rgba(0,0,0,0.3); padding: 3px 10px; border-radius: 20px; }

        .empty-home { grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed #334155; }
        .empty-home .ghost { font-size: 2.5rem; margin-bottom: 10px; opacity: 0.7; }
        .empty-home button { margin-top: 15px; background: #38bdf8; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; color: #0f172a; }
        .empty-state { text-align: center; padding: 40px; color: #64748b; font-size: 0.9rem; width: 100%; }
      `}</style>
    </div>
  );
}
