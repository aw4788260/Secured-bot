import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

// استدعاء صورة اللوجو بشكل صحيح (تأكد من أن المسار يطابق هيكل مشروعك)
import medaadLogo from '../styles/medaad-logo.png';

// ─── SVG Icons ──────────────────────────────────────────
const HomeIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>);
const TeachersIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const StudentsIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>);
const RequestsIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>);
const CouponIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>);
const WheelIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="12" x2="14.5" y2="14.5"></line></svg>);
const FinanceIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>);
const NotifIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>);
const SettingsIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path></svg>);

export default function SuperLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Load saved theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('medaad_theme');
    if (savedTheme) setIsDark(savedTheme === 'dark');
    else setIsDark(true);
  }, []);

  const toggleTheme = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    localStorage.setItem('medaad_theme', newVal ? 'dark' : 'light');
  };

  // Session check
  useEffect(() => {
    const checkSession = async () => {
      setIsChecking(true);
      const adminId = localStorage.getItem('admin_user_id');
      const isAdminSession = localStorage.getItem('is_admin_session');
      const storedName = localStorage.getItem('admin_name');
      if (storedName) setAdminName(storedName);
      if (!adminId || !isAdminSession) { performLogout(); return; }
      try {
        const res = await fetch('/api/auth/check-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: adminId })
        });
        const data = await res.json();
        if (!res.ok || !data.valid) { performLogout(); }
        else {
          if (data.name) { setAdminName(data.name); localStorage.setItem('admin_name', data.name); }
          setIsChecking(false);
        }
      } catch (err) { performLogout(); }
    };
    checkSession();
  }, [router.pathname]);

  // Responsive sidebar
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth === lastWidth) return;
      lastWidth = currentWidth;
      if (currentWidth <= 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // منع التمرير الخلفي في الهاتف عند فتح القائمة
  useEffect(() => {
    if (window.innerWidth <= 768 && isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isSidebarOpen]);

  const performLogout = async () => {
    try { await fetch('/api/auth/logout'); } catch (e) {}
    localStorage.removeItem('admin_user_id');
    localStorage.removeItem('is_admin_session');
    localStorage.removeItem('admin_name');
    router.replace('/admin/login');
  };

  const menuItems = [
    { name: 'لوحة القيادة', path: '/admin/super', icon: <HomeIcon /> },
    { name: 'إدارة المدرسين', path: '/admin/super/teachers', icon: <TeachersIcon /> },
    { name: 'إدارة الطلاب', path: '/admin/super/students', icon: <StudentsIcon /> },
    { name: 'كل طلبات الاشتراك', path: '/admin/super/requests', icon: <RequestsIcon /> },
    { name: 'أكواد الخصم (كوبونات)', path: '/admin/super/discount-codes', icon: <CouponIcon /> },
    { name: 'عجلة الحظ', path: '/admin/super/wheel', icon: <WheelIcon /> },
    { name: 'التقارير المالية', path: '/admin/super/finance', icon: <FinanceIcon /> },
    { name: 'إرسال الإشعارات', path: '/admin/super/notifications', icon: <NotifIcon /> },
    { name: 'إعدادات المنصة', path: '/admin/super/settings', icon: <SettingsIcon /> },
  ];

  if (isChecking) {
    return (
      <div style={{ minHeight: '100vh', background: isDark ? '#0d0d0d' : '#faf8f2', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '15px' }}>
        <div style={{ width: 52, height: 52, border: `4px solid ${isDark ? '#2a2a2a' : '#e8dfc0'}`, borderTop: `4px solid #c9a84c`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#c9a84c', fontFamily: 'sans-serif', fontWeight: 'bold' }}>جاري تحميل لوحة المدير العام... 🔐</p>
        <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div className={`layout-root ${isDark ? 'dark' : 'light'}`}>
      <Head><title>{title ? `${title} | مداد` : 'لوحة الإدارة العليا | مداد'}</title></Head>

      {/* ───────── TOP HEADER ───────── */}
      <header className="top-header">
        <div className="header-right">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hamburger-btn" aria-label="toggle sidebar">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="platform-label">الإدارة العليا</span>
        </div>

        <div className="header-left">
          {/* اسم الإدمن بالتصميم الجديد (Profile Chip) */}
          {adminName && (
            <div className="admin-profile-chip">
              <div className="admin-avatar">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <span className="admin-name">{adminName}</span>
            </div>
          )}

          <button onClick={toggleTheme} className="theme-toggle" title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setShowLogoutModal(true)} className="logout-btn">
            <span className="logout-text">خروج</span>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" style={{ transform: 'rotate(180deg)' }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ───────── BODY ───────── */}
      <div className="body-wrapper">
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          {/* Sidebar logo - مع التكبير ليتناسب مع العرض */}
          <div className="sidebar-logo-wrap">
            <img 
              src={medaadLogo?.src || '/medaad-logo.png'} 
              alt="مداد" 
              style={{ width: '100%', maxWidth: '180px', height: 'auto', objectFit: 'contain' }} 
            />
          </div>
          <div className="sidebar-divider" />
          <nav className="nav-container">
            {menuItems.map(item => (
              <button
                key={item.path}
                onClick={() => { router.push(item.path); if (window.innerWidth <= 768) setIsSidebarOpen(false); }}
                className={`nav-item ${router.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.name}</span>
                {router.pathname === item.path && <span className="active-bar" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span>مداد © {new Date().getFullYear()}</span>
          </div>
        </aside>

        {isSidebarOpen && <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />}

        <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
          {children}
        </main>
      </div>

      {/* ───────── LOGOUT MODAL ───────── */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-icon-wrap">👋</div>
            <h3>تسجيل الخروج</h3>
            <p>هل أنت متأكد من أنك تريد إنهاء جلسة الإدارة؟</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutModal(false)}>تراجع</button>
              <button className="btn-confirm" onClick={performLogout}>نعم، خروج</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; }

        /* ── THEME VARS ── */
        .layout-root.dark {
          --bg-base:        #111009;
          --bg-surface:     #1a1710;
          --bg-elevated:    #221f13;
          --bg-hover:       #2c2818;
          --border:         #3a3420;
          --border-accent:  #5a4e28;
          --gold:           #c9a84c;
          --gold-light:     #e8c96a;
          --gold-dim:       rgba(201,168,76,0.15);
          --gold-dimmer:    rgba(201,168,76,0.07);
          --text-primary:   #f5f0e0;
          --text-secondary: #a89f7a;
          --text-muted:     #6b6245;
          --shadow:         0 4px 24px rgba(0,0,0,0.5);
          --header-bg:      #16130c;
        }
        .layout-root.light {
          --bg-base:        #faf8f0;
          --bg-surface:     #ffffff;
          --bg-elevated:    #f5f0e0;
          --bg-hover:       #ede8d4;
          --border:         #ddd4a8;
          --border-accent:  #c9a84c;
          --gold:           #b8903a;
          --gold-light:     #d4a843;
          --gold-dim:       rgba(184,144,58,0.12);
          --gold-dimmer:    rgba(184,144,58,0.06);
          --text-primary:   #1a1508;
          --text-secondary: #6b5a2a;
          --text-muted:     #9e8850;
          --shadow:         0 4px 24px rgba(0,0,0,0.1);
          --header-bg:      #ffffff;
        }

        body { 
          margin: 0; 
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
          overflow-x: hidden; 
          background: var(--bg-base); 
          direction: rtl; 
        }

        .layout-root { 
          display: flex; 
          flex-direction: column; 
          min-height: 100vh; 
          background: var(--bg-base); 
          color: var(--text-primary); 
          transition: background 0.3s, color 0.3s; 
          overflow-x: hidden;
        }

        /* ── HEADER ── */
        .top-header {
          height: 64px;
          background: var(--header-bg);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 60;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        }
        .header-right, .header-left { display: flex; align-items: center; gap: 10px; }
        .header-left { justify-content: flex-end; }

        .hamburger-btn {
          background: var(--gold-dimmer);
          border: 1px solid var(--border);
          color: var(--gold);
          width: 38px; height: 38px;
          border-radius: 8px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .hamburger-btn:hover { background: var(--gold-dim); border-color: var(--gold); }

        .platform-label { color: var(--gold); font-weight: 700; font-size: 1.05rem; margin-right: 6px; letter-spacing: 0.02em; }

        /* ── ADMIN PROFILE CHIP ── */
        .admin-profile-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 14px 4px 4px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 30px;
          margin-left: 8px;
        }
        .admin-avatar {
          width: 30px;
          height: 30px;
          background: linear-gradient(135deg, var(--gold), var(--gold-light));
          color: #111009;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.95rem;
          box-shadow: 0 2px 8px rgba(201,168,76,0.3);
        }
        .admin-name {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.9rem;
        }

        .theme-toggle {
          background: var(--gold-dimmer);
          border: 1px solid var(--border);
          border-radius: 8px;
          width: 36px; height: 36px;
          cursor: pointer;
          font-size: 1.1rem;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .theme-toggle:hover { border-color: var(--gold); background: var(--gold-dim); }

        .logout-btn {
          background: var(--gold-dimmer);
          color: var(--gold);
          border: 1px solid var(--border-accent);
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.88rem;
          display: flex; align-items: center; gap: 7px;
          transition: all 0.2s;
        }
        .logout-btn:hover { background: var(--gold); color: #111009; border-color: var(--gold); }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 264px;
          background: var(--bg-surface);
          border-left: 1px solid var(--border);
          position: fixed;
          top: 64px; bottom: 0; right: 0;
          z-index: 50;
          display: flex; flex-direction: column;
          transition: transform 0.3s ease;
          overflow-y: auto;
        }
        .sidebar.open  { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); }

        .sidebar-logo-wrap {
          padding: 24px 20px 20px;
          display: flex; align-items: center; justify-content: center;
        }
        .sidebar-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); margin: 0 16px 12px; opacity: 0.4; }

        .nav-container { display: flex; flex-direction: column; gap: 4px; padding: 0 12px; flex: 1; }
        .nav-item {
          position: relative;
          display: flex; align-items: center; gap: 12px;
          width: 100%; text-align: right;
          padding: 11px 14px;
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.92rem;
          transition: all 0.2s;
          direction: rtl;
        }
        .nav-item:hover { background: var(--gold-dimmer); color: var(--gold); border-color: var(--border); transform: translateX(-3px); }
        .nav-item.active { background: var(--gold-dim); color: var(--gold-light); border-color: var(--border-accent); }
        .nav-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: inherit; }
        .nav-label { flex: 1; }
        .active-bar { position: absolute; right: 0; top: 20%; bottom: 20%; width: 3px; background: var(--gold); border-radius: 2px; }

        .sidebar-footer {
          padding: 16px;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.75rem;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }

        /* ── MAIN ── */
        .body-wrapper { display: flex; padding-top: 64px; min-height: 100vh; width: 100%; overflow-x: hidden; }
        .main-content { flex: 1; padding: 30px; transition: margin-right 0.3s ease; width: 100%; }

        @media (min-width: 769px) {
          .main-content.shifted { margin-right: 264px; }
          .mobile-overlay { display: none; }
        }
        @media (max-width: 768px) {
          .main-content { 
            padding: 16px; 
            margin-right: 0 !important; 
            width: 100%; 
            max-width: 100vw; 
            overflow-x: hidden; 
          }
          .sidebar { 
            width: 280px; 
            max-width: 85vw; 
            box-shadow: -6px 0 25px rgba(0,0,0,0.5); 
          }
          .mobile-overlay { 
            position: fixed; 
            top: 64px; bottom: 0; left: 0; right: 0; 
            background: rgba(0,0,0,0.6); 
            z-index: 45; 
            backdrop-filter: blur(3px); 
            display: block; 
          }
          .admin-profile-chip, .logout-text { display: none; }
        }

        /* ── LOGOUT MODAL ── */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.75);
          z-index: 1000;
          display: flex; justify-content: center; align-items: center;
          backdrop-filter: blur(5px);
          animation: fadeIn 0.2s;
        }
        .modal-box {
          background: var(--bg-surface);
          padding: 36px 30px;
          border-radius: 18px;
          border: 1px solid var(--border-accent);
          width: 90%; max-width: 380px;
          text-align: center;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
          animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-icon-wrap { font-size: 2.8rem; margin-bottom: 10px; }
        .modal-box h3 { margin: 0 0 10px 0; color: var(--gold); font-size: 1.35rem; }
        .modal-box p { color: var(--text-secondary); margin-bottom: 28px; line-height: 1.6; }
        .modal-actions { display: flex; gap: 12px; justify-content: center; }
        .modal-actions button { padding: 10px 24px; border-radius: 9px; font-weight: 700; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; border: none; }
        .btn-cancel { background: transparent; color: var(--text-secondary); border: 1px solid var(--border) !important; }
        .btn-cancel:hover { background: var(--bg-elevated); color: var(--text-primary); }
        .btn-confirm { background: var(--gold); color: #111009; }
        .btn-confirm:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 6px 18px rgba(201,168,76,0.35); }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.92) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        /* ── SCROLLBAR ── */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-base); }
        ::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--gold); }
      `}</style>
    </div>
  );
}
