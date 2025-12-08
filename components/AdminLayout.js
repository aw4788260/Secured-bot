import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [adminName, setAdminName] = useState(''); // [جديد] حالة لحفظ اسم الأدمن

  // ----------------------------------------------------------------
  // 1. useEffect الخاص بالتحقق من الجلسة (يعمل عند التحميل وعند كل تنقل)
  // ----------------------------------------------------------------
  useEffect(() => {
    const checkSession = async () => {
      // إظهار شاشة التحميل فوراً عند بدء التنقل
      setIsChecking(true);

      const userId = localStorage.getItem('auth_user_id');
      const isAdminSession = localStorage.getItem('is_admin_session');
      // محاولة قراءة الاسم من التخزين المحلي كقيمة أولية
      const storedName = localStorage.getItem('admin_name');
      if (storedName) setAdminName(storedName);

      // فحص مبدئي للبيانات المحلية
      if (!userId || !isAdminSession) {
        handleLogout();
        return;
      }

      try {
        // إرسال طلب للسيرفر (الكوكيز تذهب تلقائياً)
        const res = await fetch('/api/auth/check-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }) 
        });
        
        const data = await res.json();

        if (!res.ok || !data.valid) {
          // الجلسة غير صالحة -> طرد
          handleLogout();
        } else {
          // الجلسة سليمة -> إخفاء شاشة التحميل وعرض المحتوى
          // [جديد] تحديث الاسم إذا كان موجوداً في رد السيرفر
          if (data.name) {
              setAdminName(data.name);
              localStorage.setItem('admin_name', data.name); // تحديث المحلي
          }
          setIsChecking(false);
        }

      } catch (err) {
        // خطأ اتصال -> طرد
        handleLogout(); 
      }
    };

    checkSession();

  // 👇 هذا هو السر: وضعنا router.pathname هنا
  // هذا يعني: كلما تغير الرابط، أعد تشغيل دالة checkSession
  }, [router.pathname]); 


  // ----------------------------------------------------------------
  // 2. useEffect الخاص بضبط حجم الشاشة (يعمل مرة واحدة فقط)
  // ----------------------------------------------------------------
  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth <= 768) setIsSidebarOpen(false);
        else setIsSidebarOpen(true);
    };
    
    // الضبط الأولي
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // دالة الخروج
  const handleLogout = async () => {
    try { await fetch('/api/auth/logout'); } catch(e) {}
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

  // شاشة التحميل (ستظهر الآن عند كل تنقل بين الصفحات)
  if (isChecking) {
      return (
        <div style={{minHeight:'100vh', background:'#0f172a', display:'flex', justifyContent:'center', alignItems:'center', color:'#38bdf8', flexDirection:'column', gap:'15px'}}>
            <div className="spinner"></div>
            <h3>جاري التحقق من الصلاحيات... 🔐</h3>
            <style jsx>{`
                .spinner {
                    width: 40px; height: 40px;
                    border: 4px solid #334155; border-top: 4px solid #38bdf8;
                    border-radius: 50%; animation: spin 1s linear infinite;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
      );
  }

  return (
    <div className="layout-container">
      <Head><title>{title || 'لوحة التحكم'}</title></Head>

      <header className="top-header">
          <div className="header-right">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hamburger-btn">☰</button>
             <h3 style={{margin:0, color:'#38bdf8', marginRight:'15px', fontSize:'1.2rem'}}>لوحة التحكم</h3>
             
             {/* [جديد] عرض اسم الأدمن */}
             {adminName && <span className="admin-name-badge">👤 {adminName}</span>}
          </div>
          <button onClick={handleLogout} className="logout-btn-header">خروج 🚪</button>
      </header>

      <div className="body-wrapper">
          <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
            <nav className="nav-container">
                {menuItems.map(item => (
                    <button key={item.path} 
                        onClick={() => { 
                            // التحقق سيحدث تلقائياً بسبب تغيير المسار router.push
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

      <style jsx global>{`
        body { margin: 0; background: #0f172a; font-family: sans-serif; overflow-x: hidden; }
        .layout-container { display: flex; flex-direction: column; min-height: 100vh; }
        .top-header { height: 60px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; position: fixed; top: 0; left: 0; right: 0; z-index: 60; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header-right { display: flex; align-items: center; }
        .hamburger-btn { background: transparent; border: 1px solid #334155; color: #38bdf8; font-size: 20px; cursor: pointer; padding: 5px 10px; borderRadius: 6px; transition: all 0.2s; margin-left: 15px; }
        .hamburger-btn:hover { background: #334155; }
        
        /* [جديد] تنسيق اسم الأدمن */
        .admin-name-badge { color: #94a3b8; font-size: 0.9em; margin-right: 20px; font-weight: bold; border-right: 1px solid #334155; padding-right: 15px; }

        .logout-btn-header { background: #ef4444; color: white; border: none; padding: 8px 15px; borderRadius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em; }
        .sidebar { width: 260px; background: #1e293b; border-left: 1px solid #334155; position: fixed; top: 60px; bottom: 0; right: 0; z-index: 50; padding: 20px 10px; transition: transform 0.3s ease-in-out; overflow-y: auto; }
        .sidebar.open { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); }
        .nav-container { display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: block; width: 100%; text-align: right; padding: 12px 15px; background: transparent; color: #cbd5e1; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; transition: all 0.2s ease; }
        .nav-item:hover { background: rgba(56, 189, 248, 0.1); color: #38bdf8; transform: translateX(-5px); }
        .nav-item.active { background: #38bdf8; color: #0f172a; }
        .main-content { margin-top: 60px; padding: 30px; flex-grow: 1; transition: margin-right 0.3s ease-in-out; }
        @media (min-width: 769px) { .main-content.shifted { margin-right: 260px; } .main-content { margin-right: 0; } .mobile-overlay { display: none; } }
        @media (max-width: 768px) { 
            .main-content { margin-right: 0 !important; padding: 20px; } 
            .sidebar { box-shadow: -5px 0 15px rgba(0,0,0,0.5); width: 75%; max-width: 280px; } 
            .mobile-overlay { position: fixed; top: 60px; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); z-index: 45; backdrop-filter: blur(2px); } 
            .admin-name-badge { display: none; } /* إخفاء الاسم في الموبايل لتوفير المساحة */
        }
      `}</style>
    </div>
  );
}
