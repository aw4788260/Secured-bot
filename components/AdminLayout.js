import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  // القائمة مفتوحة افتراضياً في الشاشات الكبيرة، ومغلقة في الصغيرة
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // التحقق من الجلسة وضبط الحالة الأولية بناءً على حجم الشاشة
  useEffect(() => {
    const isAdmin = localStorage.getItem('is_admin_session');
    if (!isAdmin) router.replace('/admin/login');

    // دالة لضبط الحالة بناءً على العرض
    const handleResize = () => {
        if (window.innerWidth <= 768) {
            setIsSidebarOpen(false); // موبايل: مغلق افتراضياً
        } else {
            setIsSidebarOpen(true);  // كمبيوتر: مفتوح افتراضياً
        }
    };

    // تشغيل مرة واحدة عند التحميل (لتجنب مشاكل الـ SSR)
    if (window.innerWidth <= 768) setIsSidebarOpen(false);

    // (اختياري) يمكنك تفعيل هذا السطر لو كنت تريد تغيير الحالة تلقائياً عند تغيير حجم النافذة
    // window.addEventListener('resize', handleResize);
    // return () => window.removeEventListener('resize', handleResize);
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

  return (
    <div className="layout-container">
      <Head><title>{title || 'لوحة التحكم'}</title></Head>

      {/* --- الشريط العلوي (Header) --- */}
      <header className="top-header">
          <div className="header-right">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hamburger-btn">
                ☰
             </button>
             <h3 style={{margin:0, color:'#38bdf8', marginRight:'15px'}}>لوحة التحكم</h3>
          </div>
          
          <button onClick={handleLogout} className="logout-btn-header">
             تسجيل خروج 🚪
          </button>
      </header>

      {/* --- جسم الصفحة --- */}
      <div className="body-wrapper">
          
          {/* القائمة الجانبية (Sidebar) */}
          <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
            <nav>
                {menuItems.map(item => (
                    <button key={item.path} 
                        onClick={() => { 
                            router.push(item.path);
                            // في الموبايل، نغلق القائمة بعد الضغط
                            if (window.innerWidth <= 768) setIsSidebarOpen(false);
                        }}
                        className={`nav-item ${router.pathname === item.path ? 'active' : ''}`}
                    >
                        {item.name}
                    </button>
                ))}
            </nav>
          </aside>

          {/* طبقة التعتيم (للموبايل فقط) */}
          {isSidebarOpen && (
              <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>
          )}

          {/* المحتوى الرئيسي */}
          <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
            {children}
          </main>
      </div>

      <style jsx global>{`
        /* الأساسيات */
        body { margin: 0; background: #0f172a; font-family: sans-serif; }
        .layout-container { min-height: 100vh; display: flex; flex-direction: column; }

        /* الشريط العلوي */
        .top-header {
            height: 60px;
            background: #1e293b;
            border-bottom: 1px solid #334155;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 20px;
            position: fixed; top: 0; left: 0; right: 0; z-index: 60;
        }
        .header-right { display: flex; align-items: center; }
        .hamburger-btn {
            background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 5px;
        }
        .logout-btn-header {
            background: #ef4444; color: white; border: none; padding: 8px 15px;
            borderRadius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;
        }

        /* القائمة الجانبية */
        .sidebar {
            width: 260px;
            background: #1e293b;
            border-left: 1px solid #334155;
            position: fixed; top: 60px; bottom: 0; right: 0; z-index: 50;
            padding: 20px 15px;
            transition: transform 0.3s ease;
            overflow-y: auto;
        }
        .sidebar.open { transform: translateX(0); }
        .sidebar.closed { transform: translateX(100%); } /* إخفاء لليمين */

        /* أزرار القائمة */
        .nav-item {
            display: block; width: 100%; text-align: right; padding: 12px 15px;
            background: transparent; color: #cbd5e1;
            border: none; border-radius: 8px; margin-bottom: 10px;
            cursor: pointer; font-weight: bold; font-size: 15px;
            transition: all 0.2s;
        }
        .nav-item:hover { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .nav-item.active { background: #38bdf8; color: #0f172a; }

        /* المحتوى الرئيسي */
        .main-content {
            margin-top: 60px; /* ارتفاع الهيدر */
            padding: 30px;
            width: 100%;
            transition: margin-right 0.3s ease; /* تنعيم حركة الدفع */
        }

        /* --- وضع الكمبيوتر (Desktop) --- */
        @media (min-width: 769px) {
            .main-content.shifted {
                margin-right: 260px; /* دفع المحتوى لليسار عند فتح القائمة */
            }
            .main-content {
                margin-right: 0; /* استغلال كامل العرض عند الغلق */
            }
            .mobile-overlay { display: none; }
        }

        /* --- وضع الموبايل (Mobile) --- */
        @media (max-width: 768px) {
            .main-content {
                margin-right: 0 !important; /* لا يوجد دفع في الموبايل */
                padding: 20px;
            }
            .sidebar {
                box-shadow: -5px 0 15px rgba(0,0,0,0.5); /* ظل للقائمة */
                width: 80%; max-width: 300px;
            }
            .mobile-overlay {
                position: fixed; top: 60px; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.5); z-index: 45;
            }
        }
      `}</style>
    </div>
  );
}
