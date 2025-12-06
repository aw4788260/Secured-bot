import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // للموبايل

  // حماية الصفحة: التأكد من تسجيل الدخول
  useEffect(() => {
    const isAdmin = localStorage.getItem('is_admin_session');
    if (!isAdmin) {
        router.replace('/admin/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.replace('/admin/login');
  };

  const menuItems = [
    { name: '🏠 الرئيسية', path: '/admin' },
    { name: '📥 طلبات الاشتراك', path: '/admin/requests' }, // سنبنيها الخطوة القادمة
    { name: '👥 إدارة الطلاب', path: '/admin/students' },
    { name: '📚 إدارة المحتوى', path: '/admin/content' },
    { name: '👮 المشرفين', path: '/admin/admins' },
  ];

  return (
    <div style={{minHeight:'100vh', background:'#0f172a', color:'white', display:'flex'}}>
      <Head><title>{title || 'لوحة التحكم'}</title></Head>

      {/* Sidebar (Desktop) */}
      <aside style={{
          width: '260px', background:'#1e293b', borderLeft:'1px solid #334155',
          display: 'flex', flexDirection:'column', padding:'20px',
          position: 'fixed', right:0, top:0, bottom:0, zIndex:50,
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(0)', // في الموبايل سنخفيه
          transition: 'transform 0.3s'
      }} className="desktop-sidebar">
        
        <h2 style={{color:'#38bdf8', textAlign:'center', marginBottom:'40px', borderBottom:'1px solid #334155', paddingBottom:'20px'}}>
          لوحة القيادة ⚙️
        </h2>

        <nav style={{flex:1}}>
            {menuItems.map(item => (
                <button key={item.path} 
                    onClick={() => router.push(item.path)}
                    style={{
                        display:'block', width:'100%', textAlign:'right', padding:'12px 15px',
                        background: router.pathname === item.path ? '#38bdf8' : 'transparent',
                        color: router.pathname === item.path ? '#0f172a' : '#cbd5e1',
                        border:'none', borderRadius:'8px', marginBottom:'10px',
                        cursor:'pointer', fontWeight:'bold', fontSize:'15px',
                        transition: 'all 0.2s'
                    }}
                >
                    {item.name}
                </button>
            ))}
        </nav>

        <button onClick={handleLogout} style={{
            background:'#ef4444', color:'white', border:'none', padding:'12px',
            borderRadius:'8px', cursor:'pointer', fontWeight:'bold', marginTop:'auto'
        }}>
            تسجيل خروج 🚪
        </button>
      </aside>

      {/* Main Content */}
      <main style={{marginRight: '260px', flex:1, padding:'30px', transition: 'margin 0.3s'}} className="main-content">
        {children}
      </main>

      {/* CSS للموبايل (Responsive) */}
      <style jsx global>{`
        @media (max-width: 768px) {
            .desktop-sidebar {
                transform: translateX(100%) !important; /* إخفاء افتراضي */
                width: 100% !important; /* ملء الشاشة عند الفتح */
            }
            .desktop-sidebar.open {
                transform: translateX(0) !important;
            }
            .main-content {
                margin-right: 0 !important;
                padding: 15px !important;
            }
        }
      `}</style>
    </div>
  );
}
