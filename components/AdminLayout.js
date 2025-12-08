import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';

export default function AdminLayout({ children, title }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // قائمة الروابط (يمكنك تعديلها حسب صفحاتك)
  const navItems = [
    { name: '🏠 الرئيسية', path: '/admin/dashboard' },
    { name: '📥 طلبات الاشتراك', path: '/admin/requests' },
    { name: '👥 إدارة الطلاب', path: '/admin/students' },
    { name: '👮 المشرفين', path: '/admin/admins' },
    { name: '📚 إدارة الكورسات', path: '/admin/courses' },
    // أضف أي روابط أخرى هنا
  ];

  // دالة تسجيل الخروج
  const handleLogout = async () => {
    if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' }); // تأكد أن لديك API للخروج أو احذف الكوكيز يدوياً
      document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"; // حذف الكوكيز
      router.push('/login');
    } catch (e) {
      router.push('/login');
    }
  };

  // إغلاق القائمة عند تغيير الصفحة (للموبايل)
  useEffect(() => {
    setIsOpen(false);
  }, [router.pathname]);

  return (
    <div className="admin-container" dir="rtl">
      <Head>
        <title>{title ? `${title} | لوحة التحكم` : 'لوحة التحكم'}</title>
      </Head>

      {/* 1. الشريط العلوي للموبايل فقط */}
      <header className="mobile-header">
        <button onClick={() => setIsOpen(true)} className="menu-btn">
            {/* أيقونة القائمة (Hamburger) */}
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <span className="page-title">{title}</span>
      </header>

      {/* 2. القائمة الجانبية (Sidebar) */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
            <h2>لوحة التحكم ⚙️</h2>
            {/* زر إغلاق للموبايل */}
            <button className="close-sidebar" onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <nav className="nav-links">
            {navItems.map((item) => (
                <Link key={item.path} href={item.path} className={`nav-item ${router.pathname === item.path ? 'active' : ''}`}>
                    {item.name}
                </Link>
            ))}
        </nav>

        {/* --- زر تسجيل الخروج الجديد --- */}
        <div className="logout-container">
            <button onClick={handleLogout} className="logout-btn">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logout-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>تسجيل الخروج</span>
            </button>
        </div>
      </aside>

      {/* 3. الخلفية المعتمة للموبايل (Overlay) */}
      {isOpen && <div className="overlay" onClick={() => setIsOpen(false)} />}

      {/* 4. المحتوى الرئيسي */}
      <main className="main-content">
        {children}
      </main>

      <style jsx>{`
        /* Reset & Layout */
        .admin-container {
            display: flex;
            min-height: 100vh;
            background-color: #0f172a; /* خلفية داكنة */
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        /* --- Sidebar Styles --- */
        .sidebar {
            width: 260px;
            background: #1e293b;
            border-left: 1px solid #334155;
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            transition: transform 0.3s ease;
            box-shadow: -5px 0 15px rgba(0,0,0,0.5);
        }

        .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .sidebar-header h2 { margin: 0; font-size: 1.2em; color: #38bdf8; }
        .close-sidebar { display: none; background: none; border: none; color: white; font-size: 1.5em; cursor: pointer; }

        .nav-links { flex: 1; padding: 20px 10px; overflow-y: auto; }
        .nav-item {
            display: block;
            padding: 12px 15px;
            margin-bottom: 8px;
            color: #cbd5e1;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.2s;
            font-weight: 500;
        }
        .nav-item:hover { background: rgba(56, 189, 248, 0.1); color: white; }
        .nav-item.active { background: #38bdf8; color: #0f172a; font-weight: bold; }

        /* --- Logout Button Styles (الجديد) --- */
        .logout-container {
            padding: 20px;
            border-top: 1px solid #334155;
        }
        .logout-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 12px;
            background: rgba(239, 68, 68, 0.1); /* أحمر شفاف */
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.2s;
        }
        .logout-btn:hover {
            background: #ef4444; /* أحمر صريح */
            color: white;
            border-color: #ef4444;
            transform: translateY(-2px);
        }
        .logout-icon { transform: rotate(180deg); /* تدوير الأيقونة لتناسب العربية */ }

        /* --- Main Content --- */
        .main-content {
            flex: 1;
            padding: 30px;
            margin-right: 260px; /* مسافة للسايدبار */
            width: 100%;
            overflow-x: hidden;
        }

        /* --- Mobile Header --- */
        .mobile-header {
            display: none; /* مخفي في الديسك توب */
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 60px;
            background: #1e293b;
            border-bottom: 1px solid #334155;
            align-items: center;
            padding: 0 15px;
            z-index: 900;
        }
        .menu-btn { background: none; border: none; color: #38bdf8; cursor: pointer; padding: 5px; }
        .page-title { margin-right: 15px; font-weight: bold; font-size: 1.1em; }

        /* --- Responsive Design (Mobile) --- */
        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(100%); /* إخفاء السايدبار افتراضياً لليمين */
                width: 280px;
            }
            .sidebar.open {
                transform: translateX(0); /* إظهار عند الفتح */
            }
            .main-content {
                margin-right: 0;
                padding: 20px;
                padding-top: 80px; /* مسافة للهيدر */
            }
            .mobile-header { display: flex; }
            .close-sidebar { display: block; }
            
            /* Overlay */
            .overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7);
                z-index: 999;
                backdrop-filter: blur(2px);
                animation: fadeIn 0.2s;
            }
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
