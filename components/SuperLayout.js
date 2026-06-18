import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ---- SVG Icons ----
const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9L12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const TeachersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const StudentsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const RequestsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const CouponIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const WheelIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="14.5" y2="14.5"/>
  </svg>
);
const FinanceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const NotifIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

// ---- Menu Items ----
const menuItems = [
  { name: 'لوحة القيادة',            path: '/admin/super',                  icon: HomeIcon },
  { name: 'إدارة المدرسين',           path: '/admin/super/teachers',         icon: TeachersIcon },
  { name: 'إدارة الطلاب',            path: '/admin/super/students',         icon: StudentsIcon },
  { name: 'طلبات الاشتراك',          path: '/admin/super/requests',         icon: RequestsIcon },
  { name: 'أكواد الخصم',             path: '/admin/super/discount-codes',   icon: CouponIcon },
  { name: 'عجلة الحظ',              path: '/admin/super/wheel',            icon: WheelIcon },
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
          .loading-screen {
            min-height: 100vh;
            background: #0a0a0a;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            position: relative;
          }
          .loading-logo {
            width: 70px; height: 70px;
            background: linear-gradient(135deg, #c9a84c, #f0d080);
            border-radius: 18px;
            display: flex; align-items: center; justify-content: center;
            font-size: 2.2rem; font-weight: 900; color: #0a0a0a;
            box-shadow: 0 0 40px rgba(201,168,76,0.4);
            animation: pulse 2s ease-in-out infinite;
          }
          .loading-ring {
            width: 50px; height: 50px;
            border: 3px solid rgba(201,168,76,0.15);
            border-top-color: #c9a84c;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-text { color: #7a6535; font-size: 0.95rem; letter-spacing: 0.05em; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { box-shadow: 0 0 30px rgba(201,168,76,0.3); } 50% { box-shadow: 0 0 60px rgba(201,168,76,0.6); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`layout-root ${mounted ? 'mounted' : ''}`} dir="rtl">
      <Head><title>{title ? `${title} | مداد` : 'مداد — الإدارة العليا'}</title></Head>

      {/* ══════════════ TOP HEADER ══════════════ */}
      <header className="top-header">
        <div className="header-left">
          <button className="hamburger" onClick={() => setIsSidebarOpen(v => !v)} aria-label="القائمة">
            <MenuIcon />
          </button>
          <div className="header-brand">
            <span className="brand-letter">م</span>
            <span className="brand-name">مداد</span>
          </div>
        </div>

        <div className="header-right">
          {adminName && (
            <div className="admin-chip">
              <ShieldIcon />
              <span>{adminName}</span>
            </div>
          )}
          <button className="logout-btn" onClick={() => setShowLogoutModal(true)} title="تسجيل الخروج">
            <LogoutIcon />
            <span className="logout-label">خروج</span>
          </button>
        </div>
      </header>

      <div className="body-wrapper">
        {/* ══════════════ SIDEBAR ══════════════ */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-inner">
            <div className="sidebar-logo">
              <div className="sidebar-logo-mark">م</div>
              <div>
                <div className="sidebar-logo-name">مداد</div>
                <div className="sidebar-logo-sub">الإدارة العليا</div>
              </div>
            </div>

            <div className="sidebar-divider" />

            <nav className="nav-list">
              {menuItems.map((item, i) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => {
                      router.push(item.path);
                      if (window.innerWidth <= 768) setIsSidebarOpen(false);
                    }}
                  >
                    {isActive && <span className="nav-glow" />}
                    <span className="nav-icon"><Icon /></span>
                    <span className="nav-label">{item.name}</span>
                    {isActive && <span className="nav-indicator" />}
                  </button>
                );
              })}
            </nav>

            <div className="sidebar-footer">
              <div className="sidebar-footer-text">مداد © {new Date().getFullYear()}</div>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* ══════════════ MAIN CONTENT ══════════════ */}
        <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
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
          --gold:        #c9a84c;
          --gold-light:  #f0d080;
          --gold-dim:    #7a6535;
          --gold-subtle: rgba(201,168,76,0.08);
          --gold-border: rgba(201,168,76,0.18);
          --bg:          #0a0a0a;
          --bg-card:     #111111;
          --bg-raised:   #181818;
          --border:      rgba(255,255,255,0.06);
          --text:        #e8dcc8;
          --text-muted:  #6b5e45;
          --text-dim:    #3d3428;
          --header-h:    64px;
          --sidebar-w:   260px;
          --radius:      14px;
          --radius-sm:   8px;
          --shadow:      0 4px 24px rgba(0,0,0,0.6);
          --shadow-gold: 0 0 30px rgba(201,168,76,0.2);
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

        /* ── Layout Root ── */
        .layout-root {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .layout-root.mounted { opacity: 1; }

        /* ── Header ── */
        .top-header {
          height: var(--header-h);
          background: var(--bg-card);
          border-bottom: 1px solid var(--gold-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 0 var(--gold-border), 0 4px 20px rgba(0,0,0,0.4);
        }

        .header-left, .header-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .hamburger {
          background: transparent;
          border: 1px solid var(--gold-border);
          color: var(--gold);
          width: 38px; height: 38px;
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .hamburger:hover {
          background: var(--gold-subtle);
          border-color: var(--gold);
          box-shadow: var(--shadow-gold);
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-letter {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, var(--gold), var(--gold-light));
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; font-weight: 900; color: #0a0a0a;
          box-shadow: 0 0 16px rgba(201,168,76,0.3);
        }
        .brand-name {
          font-size: 1.15rem;
          font-weight: 700;
          background: linear-gradient(90deg, var(--gold), var(--gold-light));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 0.03em;
        }

        .admin-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          background: var(--gold-subtle);
          border: 1px solid var(--gold-border);
          color: var(--gold);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .logout-btn {
          background: transparent;
          border: 1px solid rgba(201,168,76,0.25);
          color: var(--gold-dim);
          padding: 7px 14px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex; align-items: center; gap: 7px;
          transition: all 0.2s;
        }
        .logout-btn:hover {
          background: rgba(201,168,76,0.12);
          color: var(--gold);
          border-color: var(--gold);
        }

        /* ── Body Wrapper ── */
        .body-wrapper {
          display: flex;
          margin-top: var(--header-h);
          min-height: calc(100vh - var(--header-h));
          position: relative;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: var(--sidebar-w);
          background: var(--bg-card);
          border-left: 1px solid var(--gold-border);
          position: fixed;
          top: var(--header-h);
          bottom: 0;
          right: 0;
          z-index: 80;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: var(--gold-border) transparent;
          transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .sidebar.open  { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px 14px;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 8px 20px;
        }
        .sidebar-logo-mark {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, var(--gold), var(--gold-light));
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; font-weight: 900; color: #0a0a0a;
          box-shadow: 0 0 20px rgba(201,168,76,0.25);
          flex-shrink: 0;
        }
        .sidebar-logo-name {
          font-size: 1.05rem; font-weight: 700;
          background: linear-gradient(90deg, var(--gold), var(--gold-light));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .sidebar-logo-sub {
          font-size: 0.72rem; color: var(--gold-dim); margin-top: 2px; letter-spacing: 0.04em;
        }

        .sidebar-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold-border), transparent);
          margin-bottom: 18px;
        }

        .nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: right;
          padding: 11px 14px;
          background: transparent;
          color: var(--text-muted);
          border: 1px solid transparent;
          border-radius: var(--radius);
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.22s ease;
          animation: navSlide 0.4s ease both;
          overflow: hidden;
          font-family: inherit;
        }
        @keyframes navSlide {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .nav-item:hover {
          color: var(--gold-light);
          background: var(--gold-subtle);
          border-color: var(--gold-border);
          transform: translateX(-3px);
        }

        .nav-item.active {
          color: var(--gold-light);
          background: linear-gradient(135deg, rgba(201,168,76,0.14), rgba(201,168,76,0.06));
          border-color: var(--gold-border);
          box-shadow: 0 2px 16px rgba(201,168,76,0.1);
        }

        .nav-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 80% 50%, rgba(201,168,76,0.12), transparent 70%);
          pointer-events: none;
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px; height: 30px;
          border-radius: 8px;
          background: var(--gold-subtle);
          flex-shrink: 0;
          transition: all 0.22s;
        }
        .nav-item.active .nav-icon {
          background: linear-gradient(135deg, rgba(201,168,76,0.3), rgba(201,168,76,0.15));
          box-shadow: 0 0 12px rgba(201,168,76,0.2);
          color: var(--gold);
        }
        .nav-item:hover .nav-icon { background: rgba(201,168,76,0.15); }

        .nav-label { flex: 1; }

        .nav-indicator {
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 60%;
          background: linear-gradient(180deg, var(--gold-light), var(--gold));
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 10px rgba(201,168,76,0.5);
        }

        .sidebar-footer {
          padding-top: 20px;
          border-top: 1px solid var(--gold-border);
          margin-top: 12px;
        }
        .sidebar-footer-text {
          font-size: 0.72rem;
          color: var(--text-dim);
          text-align: center;
          letter-spacing: 0.04em;
        }

        /* ── Mobile Overlay ── */
        .mobile-overlay {
          display: none;
          position: fixed;
          top: var(--header-h); left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.75);
          z-index: 70;
          backdrop-filter: blur(3px);
        }

        /* ── Main Content ── */
        .main-content {
          flex: 1;
          padding: 32px;
          min-width: 0;
          transition: margin-right 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        /* ── Logout Modal ── */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.88);
          z-index: 200;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(6px);
          animation: fadeIn 0.2s ease;
        }
        .modal-box {
          background: var(--bg-card);
          border: 1px solid var(--gold-border);
          border-radius: 20px;
          padding: 36px 32px;
          width: 90%; max-width: 360px;
          text-align: center;
          box-shadow: 0 30px 60px rgba(0,0,0,0.7), 0 0 40px rgba(201,168,76,0.1);
          animation: popIn 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .modal-icon-wrap {
          width: 56px; height: 56px;
          margin: 0 auto 18px;
          background: rgba(201,168,76,0.1);
          border: 1px solid var(--gold-border);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: var(--gold);
        }
        .modal-title { color: var(--gold-light); font-size: 1.25rem; margin-bottom: 10px; }
        .modal-text  { color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 28px; }
        .modal-actions { display: flex; gap: 12px; justify-content: center; }
        .modal-cancel, .modal-confirm {
          padding: 10px 24px;
          border-radius: var(--radius-sm);
          font-weight: 700; font-size: 0.9rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          font-family: inherit;
        }
        .modal-cancel {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--gold-border) !important;
        }
        .modal-cancel:hover { background: var(--gold-subtle); color: var(--gold); }
        .modal-confirm {
          background: linear-gradient(135deg, var(--gold), var(--gold-light));
          color: #0a0a0a;
          box-shadow: 0 4px 16px rgba(201,168,76,0.3);
        }
        .modal-confirm:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(201,168,76,0.45); }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn  { from { opacity: 0; transform: scale(0.92) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        /* ── Responsive ── */
        @media (min-width: 769px) {
          .main-content.shifted { margin-right: var(--sidebar-w); }
          .main-content         { margin-right: 0; }
          .mobile-overlay       { display: none !important; }
        }

        @media (max-width: 768px) {
          .main-content { padding: 20px; margin-right: 0 !important; }
          .sidebar      { width: 78%; max-width: 290px; box-shadow: -6px 0 30px rgba(0,0,0,0.6); }
          .mobile-overlay { display: block; }
          .admin-chip   { display: none; }
          .logout-label { display: none; }
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar              { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track        { background: transparent; }
        ::-webkit-scrollbar-thumb        { background: var(--gold-border); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover  { background: var(--gold-dim); }
      `}</style>
    </div>
  );
}
