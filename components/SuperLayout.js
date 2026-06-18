import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import medaadLogo from '../styles/medaad-logo.png'; // استدعاء صورة اللوجو

// ---- SVG Icons ----
const HomeIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9L12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
const TeachersIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const StudentsIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>);
const RequestsIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>);
const CouponIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
const WheelIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="14.5" y2="14.5"/></svg>);
const FinanceIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const NotifIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
const SettingsIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>);
const MenuIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>);
const LogoutIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const ShieldIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
const NotificationBell = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
const ThemeIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>);

// ---- Menu Items ----
const menuItems = [
  { name: 'لوحة القيادة',            path: '/admin/super',                  icon: HomeIcon },
  { name: 'إدارة المدرسين',           path: '/admin/super/teachers',         icon: TeachersIcon },
  { name: 'إدارة الطلاب',            path: '/admin/super/students',         icon: StudentsIcon },
  { name: 'طلبات الاشتراك',          path: '/admin/super/requests',         icon: RequestsIcon },
  { name: 'أكواد الخصم',             path: '/admin/super/discount-codes',   icon: CouponIcon },
  { name: 'مجلة الحفظ',              path: '#',                             icon: MenuIcon }, // إضافة مجلة الحفظ كعنصر صوري للمطابقة
  { name: 'التقارير المالية',         path: '/admin/super/finance',          icon: FinanceIcon },
  { name: 'إرسال الإشعارات',         path: '/admin/super/notifications',    icon: NotifIcon },
  { name: 'إعدادات المنصة',          path: '/admin/super/settings',         icon: SettingsIcon },
];

export default function SuperLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 1. Session check
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
          body: JSON.stringify({ userId: adminId }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          performLogout();
        } else {
          if (data.name) { setAdminName(data.name); localStorage.setItem('admin_name', data.name); }
          setIsChecking(false);
        }
      } catch (err) { performLogout(); }
    };
    checkSession();
  }, [router.pathname]);

  // 2. Responsive sidebar
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const w = window.innerWidth;
      if (w === lastWidth) return;
      lastWidth = w;
      setIsSidebarOpen(w > 768);
    };
    setIsSidebarOpen(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const performLogout = async () => {
    try { await fetch('/api/auth/logout'); } catch (e) {}
    localStorage.removeItem('admin_user_id');
    localStorage.removeItem('is_admin_session');
    localStorage.removeItem('admin_name');
    router.replace('/admin/login');
  };

  if (isChecking) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">م</div>
        <div className="loading-ring"></div>
        <p className="loading-text">جاري التحقق من الصلاحيات...</p>
        <style jsx>{`
          .loading-screen { min-height: 100vh; background: #16181D; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; position: relative; }
          .loading-logo { width: 70px; height: 70px; background: linear-gradient(135deg, #E5C05C, #C99B2D); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 900; color: #111; box-shadow: 0 0 40px rgba(229,192,92,0.4); animation: pulse 2s ease-in-out infinite; }
          .loading-ring { width: 50px; height: 50px; border: 3px solid rgba(229,192,92,0.15); border-top-color: #E5C05C; border-radius: 50%; animation: spin 1s linear infinite; }
          .loading-text { color: #E5C05C; font-size: 0.95rem; letter-spacing: 0.05em; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { box-shadow: 0 0 30px rgba(229,192,92,0.3); } 50% { box-shadow: 0 0 60px rgba(229,192,92,0.6); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`layout-root ${mounted ? 'mounted' : ''}`} dir="rtl">
      <Head><title>{title ? `${title} | مداد` : 'مداد — الإدارة العليا'}</title></Head>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-inner">
          <div className="sidebar-logo">
            {/* اللوجو الذهبي الخاص بمداد */}
            <img src={medaadLogo?.src || '/medaad-logo.png'} alt="Medaad Logo" className="brand-image" />
          </div>

          <nav className="nav-list">
            {menuItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.path;
              return (
                <button
                  key={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => {
                    if (item.path !== '#') {
                      router.push(item.path);
                      if (window.innerWidth <= 768) setIsSidebarOpen(false);
                    }
                  }}
                >
                  <span className="nav-icon"><Icon /></span>
                  <span className="nav-label">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ══════════════ MAIN CONTENT AREA ══════════════ */}
      <div className={`main-wrapper ${isSidebarOpen ? 'shifted' : ''}`}>
        
        {/* ══════════════ TOP HEADER ══════════════ */}
        <header className="top-header">
          <div className="header-right">
            <button className="hamburger" onClick={() => setIsSidebarOpen(v => !v)} aria-label="القائمة">
              <MenuIcon />
            </button>
            <div className="header-actions">
               <button className="icon-btn" title="السمة"><ThemeIcon /></button>
               <button className="icon-btn" title="الإشعارات">
                 <NotificationBell />
                 <span className="notif-dot"></span>
               </button>
            </div>
          </div>

          <div className="header-left">
            <div className="user-profile" onClick={() => setShowLogoutModal(true)}>
               <div className="user-info">
                 <span className="user-name">Medaad</span>
                 <span className="user-arrow">▼</span>
               </div>
               <div className="user-avatar">
                 <img src="https://ui-avatars.com/api/?name=M&background=E5C05C&color=111" alt="Admin" />
               </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>

      {/* ══════════════ LOGOUT MODAL ══════════════ */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-wrap">
              <LogoutIcon />
            </div>
            <h3 className="modal-title">تسجيل الخروج</h3>
            <p className="modal-text">هل أنت متأكد من إنهاء جلسة الإدارة الحالية؟</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowLogoutModal(false)}>تراجع</button>
              <button className="modal-confirm" onClick={performLogout}>نعم، خروج</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ GLOBAL STYLES ══════════════ */}
      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          /* الألوان الجديدة المضيئة والمريحة للعين */
          --gold:        #D4AF37;
          --gold-light:  #E5C05C;
          --gold-dark:   #C99B2D;
          --bg:          #16181D; /* خلفية أفتح قليلاً من الأسود */
          --bg-card:     #1C1F26; /* خلفية الكروت */
          --border:      rgba(212, 175, 55, 0.15); /* حدود مذهبة خفيفة */
          --text:        #F0F6FC;
          --text-muted:  #8B949E;
          --header-h:    70px;
          --sidebar-w:   260px;
          --radius:      12px;
          --radius-sm:   8px;
          --shadow-glow: 0 4px 20px rgba(212, 175, 55, 0.04); /* توهج ذهبي خفيف جداً */
        }

        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-family: 'Segoe UI', 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
          direction: rtl;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        .layout-root {
          display: flex;
          min-height: 100vh;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .layout-root.mounted { opacity: 1; }

        /* ── Sidebar ── */
        .sidebar {
          width: var(--sidebar-w);
          background: var(--bg-card);
          border-left: 1px solid var(--border);
          position: fixed;
          top: 0;
          bottom: 0;
          right: 0;
          z-index: 90;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
          transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .sidebar.open  { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
        }

        .sidebar-logo {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px 0 30px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 20px;
        }
        .brand-image {
          width: 100%;
          max-width: 140px;
          filter: drop-shadow(0 0 10px rgba(229,192,92,0.4));
        }

        .nav-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: right;
          padding: 14px 16px;
          background: transparent;
          color: var(--text-muted);
          border: none;
          border-radius: var(--radius);
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.25s ease;
          animation: navSlide 0.4s ease both;
          font-family: inherit;
        }

        .nav-item:hover {
          color: var(--text);
          background: rgba(255,255,255,0.03);
        }

        .nav-item.active {
          background: linear-gradient(90deg, var(--gold-dark), var(--gold-light));
          color: #111;
          box-shadow: 0 4px 15px rgba(229, 192, 92, 0.25);
          font-weight: 700;
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
        }

        .nav-item.active .nav-icon {
          color: #111;
        }

        @keyframes navSlide {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ── Main Wrapper & Header ── */
        .main-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: margin-right 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        .top-header {
          height: var(--header-h);
          background: var(--bg); /* نفس لون الخلفية ليندمج بسلاسة */
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 80;
        }

        .header-right, .header-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hamburger {
          background: transparent;
          border: none;
          color: var(--text-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: color 0.2s;
        }
        .hamburger:hover { color: var(--gold-light); }

        .header-actions {
          display: flex;
          gap: 15px;
        }
        .icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .icon-btn:hover { color: var(--text); }
        .notif-dot {
          position: absolute;
          top: 0px; right: 2px;
          width: 8px; height: 8px;
          background: #E5C05C;
          border-radius: 50%;
          border: 2px solid var(--bg);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 30px;
          border: 1px solid rgba(255,255,255,0.05);
          transition: background 0.2s;
        }
        .user-profile:hover { background: rgba(255,255,255,0.03); }
        
        .user-info { display: flex; align-items: center; gap: 8px; }
        .user-name { font-weight: 600; font-size: 0.95rem; }
        .user-arrow { font-size: 0.6rem; color: var(--text-muted); }
        
        .user-avatar img {
          width: 38px; height: 38px;
          border-radius: 50%;
          border: 2px solid var(--gold-dark);
        }

        .main-content {
          padding: 20px 32px 40px;
          flex: 1;
        }

        /* ── Mobile Overlay & Modals ── */
        .mobile-overlay {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.75);
          z-index: 85;
          backdrop-filter: blur(3px);
        }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          z-index: 200;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
        }
        .modal-box {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 36px 32px;
          width: 90%; max-width: 360px;
          text-align: center;
          box-shadow: 0 30px 60px rgba(0,0,0,0.7), var(--shadow-glow);
        }
        .modal-icon-wrap {
          width: 56px; height: 56px;
          margin: 0 auto 18px;
          background: rgba(229, 192, 92, 0.1);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: var(--gold-light);
        }
        .modal-title { color: var(--text); font-size: 1.25rem; margin-bottom: 10px; }
        .modal-text  { color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 28px; }
        .modal-actions { display: flex; gap: 12px; justify-content: center; }
        .modal-cancel, .modal-confirm {
          padding: 10px 24px;
          border-radius: var(--radius-sm);
          font-weight: 700; font-size: 0.9rem;
          cursor: pointer; border: none; font-family: inherit;
        }
        .modal-cancel { background: transparent; color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1) !important; }
        .modal-confirm { background: linear-gradient(135deg, var(--gold-dark), var(--gold-light)); color: #111; }

        /* ── Responsive ── */
        @media (min-width: 769px) {
          .main-wrapper.shifted { margin-right: var(--sidebar-w); }
          .hamburger { display: none; }
        }

        @media (max-width: 768px) {
          .main-wrapper { margin-right: 0 !important; }
          .main-content { padding: 15px 20px; }
          .top-header { padding: 0 20px; }
          .sidebar { width: 280px; box-shadow: -6px 0 30px rgba(0,0,0,0.6); }
          .mobile-overlay { display: block; }
          .user-name, .user-arrow { display: none; }
        }
      `}</style>
    </div>
  );
}
