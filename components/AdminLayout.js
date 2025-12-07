import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChecking, setIsChecking] = useState(true); // حالة تحميل للتحقق

  useEffect(() => {
    const checkSession = async () => {
      // 1. قراءة البيانات المحلية
      const isAdminSession = localStorage.getItem('is_admin_session');
      const userId = localStorage.getItem('auth_user_id');
      const deviceId = localStorage.getItem('auth_device_id');

      // إذا كانت البيانات ناقصة محلياً -> طرد فوراً
      if (!isAdminSession || !userId || !deviceId) {
        handleLogout();
        return;
      }

      try {
        // 2. التحقق من السيرفر (هل البصمة ما زالت صالحة؟)
        const res = await fetch('/api/auth/check-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deviceId })
        });
        
        const data = await res.json();

        if (!res.ok || !data.valid) {
          // إذا رفض السيرفر الجلسة -> طرد
          console.warn("Session invalid:", data.message);
          handleLogout();
        } else {
          // الجلسة سليمة -> السماح بالعرض
          setIsChecking(false);
        }

      } catch (err) {
        console.error("Session check failed (Network):", err);
        // في حال انقطاع النت، يمكننا السماح بالبقاء مؤقتاً أو الطرد (حسب سياستك)
        // هنا سنطرد للأمان القصوى، أو يمكنك وضع setIsChecking(false) للسماح
        handleLogout(); 
      }
    };

    // ضبط القائمة الجانبية
    const handleResize = () => {
        if (window.innerWidth <= 768) setIsSidebarOpen(false);
        else setIsSidebarOpen(true);
    };
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
    window.addEventListener('resize', handleResize);

    // بدء التحقق
    checkSession();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.replace('/admin/login');
  };

  const menuItems = [
    { name: '🏠 الرئيسية', path: '/admin' },
    { name: '📥 طلبات الاشتراك', path: '/admin/requests' },
    { name: '👥 إدارة الطلاب', path: '/admin/students' },
    { name: '📚 إدارة المحتوى', path: '/admin/content' },
    { name: '👮 المشرفين', path: '/admin/admins' },
  ];

  // أثناء التحقق، نعرض شاشة تحميل فارغة أو بسيطة لمنع وميض المحتوى
  if (isChecking) {
      return (
        <div style={{minHeight:'100vh', background:'#0f172a', display:'flex', justifyContent:'center', alignItems:'center', color:'#38bdf8'}}>
            <h3>جاري التحقق من الأمان... 🔐</h3>
        </div>
      );
  }

  return (
    <div className="layout-container">
      <Head><title>{title || 'لوحة التحكم'}</title></Head>

      {/* الشريط العلوي */}
      <header className="top-header">
          <div className="header-right">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hamburger-btn">
                ☰
             </button>
             <h3 style={{margin:0, color:'#38bdf8', marginRight:'15px', fontSize:'1.2rem'}}>لوحة التحكم</h3>
          </div>
          
          <button onClick={handleLogout} className="logout-btn-header">
             خروج 🚪
          </button>
      </header>

      {/* الحاوية الرئيسية */}
      <div className="body-wrapper">
          
          {/* القائمة الجانبية */}
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

          {/* طبقة التعتيم للموبايل */}
          {isSidebarOpen && (
              <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>
          )}

          {/* المحتوى الرئيسي */}
          <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
            {children}
          </main>
      </div>

      <style jsx global>{`
        /* --- إعدادات الصفحة العامة --- */
        body { margin: 0; background: #0f172a; font-family: sans-serif; overflow-x: hidden; }
        .layout-container { display: flex; flex-direction: column; min-height: 100vh; }

        /* --- الشريط العلوي --- */
        .top-header {
            height: 60px;
            background: #1e293b;
            border-bottom: 1px solid #334155;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 20px;
            position: fixed; top: 0; left: 0; right: 0; z-index: 60;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header-right { display: flex; align-items: center; }
        
        .hamburger-btn {
            background: transparent; border: 1px solid #334155; 
            color: #38bdf8; font-size: 20px; cursor: pointer; 
            padding: 5px 10px; borderRadius: 6px;
            transition: all 0.2s;
        }
        .hamburger-btn:hover { background: #334155; }

        .logout-btn-header {
            background: #ef4444; color: white; border: none; padding: 8px 15px;
            borderRadius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;
        }

        /* --- القائمة الجانبية --- */
        .sidebar {
            width: 260px;
            background: #1e293b;
            border-left: 1px solid #334155;
            position: fixed; top: 60px; bottom: 0; right: 0; z-index: 50;
            padding: 20px 10px;
            transition: transform 0.3s ease-in-out;
            overflow-y: auto;
        }
        .sidebar.open { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); }

        .nav-container { display: flex; flex-direction: column; gap: 8px; }

        .nav-item {
            display: block; width: 100%; text-align: right; padding: 12px 15px;
            background: transparent; color: #cbd5e1;
            border: none; border-radius: 8px;
            cursor: pointer; font-weight: 600; font-size: 15px;
            transition: all 0.2s ease;
        }
        .nav-item:hover { background: rgba(56, 189, 248, 0.1); color: #38bdf8; transform: translateX(-5px); }
        .nav-item.active { background: #38bdf8; color: #0f172a; }

        /* --- المحتوى الرئيسي --- */
        .main-content {
            margin-top: 60px;
            padding: 30px;
            flex-grow: 1; 
            transition: margin-right 0.3s ease-in-out;
        }

        @media (min-width: 769px) {
            .main-content.shifted { margin-right: 260px; }
            .main-content { margin-right: 0; }
            .mobile-overlay { display: none; }
        }

        @media (max-width: 768px) {
            .main-content { margin-right: 0 !important; padding: 20px; }
            .sidebar { box-shadow: -5px 0 15px rgba(0,0,0,0.5); width: 75%; max-width: 280px; }
            .mobile-overlay {
                position: fixed; top: 60px; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.6); z-index: 45;
                backdrop-filter: blur(2px);
            }
        }
      `}</style>
    </div>
  );
}
