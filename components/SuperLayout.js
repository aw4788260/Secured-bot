import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function SuperLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [adminName, setAdminName] = useState('');
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 1. التحقق من الجلسة
  useEffect(() => {
    const checkSession = async () => {
      setIsChecking(true);
      
      const adminId = localStorage.getItem('admin_user_id');
      const isAdminSession = localStorage.getItem('is_admin_session');
      const storedName = localStorage.getItem('admin_name');
      
      if (storedName) setAdminName(storedName);

      if (!adminId || !isAdminSession) {
        performLogout();
        return;
      }

      try {
        const res = await fetch('/api/auth/check-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: adminId }) 
        });
        const data = await res.json();

        if (!res.ok || !data.valid) {
          performLogout();
        } else {
          if (data.name) {
              setAdminName(data.name);
              localStorage.setItem('admin_name', data.name);
          }
          setIsChecking(false);
        }
      } catch (err) {
        performLogout(); 
      }
    };
    checkSession();
  }, [router.pathname]); 

  // 2. ضبط حجم الشاشة
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

  const performLogout = async () => {
    try { await fetch('/api/auth/logout'); } catch(e) {}
    localStorage.removeItem('admin_user_id');
    localStorage.removeItem('is_admin_session');
    localStorage.removeItem('admin_name');
    router.replace('/admin/login');
  };

  // ✅ القائمة المخصصة للسوبر أدمن (تم إضافة صفحة الكوبونات)
  const menuItems = [
    { name: '🏠 لوحة القيادة', path: '/admin/super' },
    { name: '👨‍🏫 إدارة المدرسين', path: '/admin/super/teachers' },
    { name: '👨‍🎓 إدارة الطلاب', path: '/admin/super/students' },
    { name: '📥 كل طلبات الاشتراك', path: '/admin/super/requests' },
    { name: '🎟️ أكواد الخصم (كوبونات)', path: '/admin/super/discount-codes' }, // 👈 التعديل هنا
    { name: '💰 التقارير المالية', path: '/admin/super/finance' },
    { name: '📢 إرسال الإشعارات', path: '/admin/super/notifications' },
    { name: '⚙️ إعدادات المنصة', path: '/admin/super/settings' }
  ];

  if (isChecking) {
      return (
        <div style={{minHeight:'100vh', background:'#0f172a', display:'flex', justifyContent:'center', alignItems:'center', color:'#38bdf8', flexDirection:'column', gap:'15px'}}>
            <div className="spinner"></div>
            <h3>جاري تحميل لوحة المدير العام... 🔐</h3>
            <style jsx>{`
                .spinner { width: 40px; height: 40px; border: 4px solid #334155; border-top: 4px solid #ef4444; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
      );
  }

  return (
    <div className="layout-container">
      <Head><title>{title ? `${title} | الإدارة العليا` : 'الإدارة العليا'}</title></Head>

      <header className="top-header">
          <div className="header-right">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hamburger-btn">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </button>
             <h3 style={{margin:0, color:'#ef4444', marginRight:'15px', fontSize:'1.2rem'}}>الإدارة العليا</h3>
             {adminName && <span className="admin-name-badge">🛡️ {adminName}</span>}
          </div>
          
          <button onClick={() => setShowLogoutModal(true)} className="logout-btn-header" title="تسجيل الخروج">
             <span className="logout-text">خروج</span>
             <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{transform: 'rotate(180deg)'}}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
             </svg>
          </button>
      </header>

      <div className="body-wrapper">
          <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
            <nav className="nav-container">
                {menuItems.map(item => (
                    <button key={item.path} 
                        onClick={() => { 
                            router.push(item.path);
                            if (window.innerWidth <= 768) setIsSidebarOpen(false);
                        }}
                        className={`nav-item ${router.pathname === item.path ? 'active' : ''}`}
                    >
                        {item.name}
                    </button>
                ))}
            </nav>
          </aside>

          {isSidebarOpen && (
              <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>
          )}

          <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
            {children}
          </main>
      </div>

      {showLogoutModal && (
          <div className="logout-modal-overlay">
              <div className="logout-modal-box">
                  <div className="modal-icon">👋</div>
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
        body { margin: 0; background: #0f172a; font-family: sans-serif; overflow-x: hidden; }
        .layout-container { display: flex; flex-direction: column; min-height: 100vh; }
        .top-header { height: 60px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; position: fixed; top: 0; left: 0; right: 0; z-index: 60; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header-right { display: flex; align-items: center; }
        .hamburger-btn { background: transparent; border: 1px solid #334155; color: #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 5px; borderRadius: 6px; transition: all 0.2s; margin-left: 15px; }
        .hamburger-btn:hover { background: #334155; }
        
        .admin-name-badge { color: #94a3b8; font-size: 0.9em; margin-right: 20px; font-weight: bold; border-right: 1px solid #334155; padding-right: 15px; }

        .logout-btn-header { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 12px; borderRadius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .logout-btn-header:hover { background: #ef4444; color: white; border-color: #ef4444; }

        .sidebar { width: 260px; background: #1e293b; border-left: 1px solid #334155; position: fixed; top: 60px; bottom: 0; right: 0; z-index: 50; padding: 20px 10px; transition: transform 0.3s ease-in-out; overflow-y: auto; }
        .sidebar.open { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); }
        .nav-container { display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: block; width: 100%; text-align: right; padding: 12px 15px; background: transparent; color: #cbd5e1; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; transition: all 0.2s ease; }
        .nav-item:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; transform: translateX(-5px); }
        .nav-item.active { background: #ef4444; color: white; }
        .main-content { margin-top: 60px; padding: 30px; flex-grow: 1; transition: margin-right 0.3s ease-in-out; }
        
        @media (min-width: 769px) { .main-content.shifted { margin-right: 260px; } .main-content { margin-right: 0; } .mobile-overlay { display: none; } }
        @media (max-width: 768px) { 
            .main-content { margin-right: 0 !important; padding: 20px; } 
            .sidebar { box-shadow: -5px 0 15px rgba(0,0,0,0.5); width: 75%; max-width: 280px; } 
            .mobile-overlay { position: fixed; top: 60px; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); z-index: 45; backdrop-filter: blur(2px); } 
            .admin-name-badge { display: none; }
            .logout-text { display: none; } 
        }

        .logout-modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 1000;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s;
        }
        .logout-modal-box {
            background: #1e293b;
            padding: 30px;
            border-radius: 16px;
            border: 1px solid #475569;
            width: 90%; max-width: 380px;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-icon { font-size: 3em; margin-bottom: 10px; }
        .logout-modal-box h3 { margin: 0 0 10px 0; color: #f87171; font-size: 1.4em; }
        .logout-modal-box p { color: #cbd5e1; margin-bottom: 25px; line-height: 1.5; }
        
        .modal-actions { display: flex; gap: 12px; justify-content: center; }
        .modal-actions button { padding: 10px 20px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.95em; }
        .btn-cancel { background: transparent; color: #cbd5e1; border: 1px solid #475569 !important; }
        .btn-cancel:hover { background: rgba(255,255,255,0.05); color: white; }
        .btn-confirm { background: #ef4444; color: white; }
        .btn-confirm:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(239, 68, 68, 0.4); }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
