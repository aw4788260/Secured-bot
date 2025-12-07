import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // حماية الصفحة
  useEffect(() => {
    const isAdmin = localStorage.getItem('is_admin_session');
    if (!isAdmin) router.replace('/admin/login');
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
    <div style={{minHeight:'100vh', background:'#0f172a', color:'white', display:'flex', flexDirection:'column'}}>
      <Head><title>{title || 'لوحة التحكم'}</title></Head>

      {/* --- [جديد] شريط علوي للموبايل فقط --- */}
      <div className="mobile-header" style={{
          padding: '15px', background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'none', alignItems: 'center', justifyContent: 'space-between'
      }}>
          <h3 style={{margin:0, color:'#38bdf8'}}>لوحة التحكم</h3>
          <button onClick={() => setIsSidebarOpen(true)} style={{background:'none', border:'none', color:'white', fontSize:'24px', cursor:'pointer'}}>
              ☰
          </button>
      </div>

      <div style={{display:'flex', flex:1, position:'relative'}}>
          
          {/* Sidebar */}
          <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px', borderBottom:'1px solid #334155', paddingBottom:'15px'}}>
                <h2 style={{color:'#38bdf8', margin:0, fontSize:'1.2em'}}>لوحة القيادة ⚙️</h2>
                {/* زر إغلاق للموبايل */}
                <button className="close-btn" onClick={() => setIsSidebarOpen(false)} style={{background:'none', border:'none', color:'#94a3b8', fontSize:'20px', cursor:'pointer'}}>✕</button>
            </div>

            <nav style={{flex:1}}>
                {menuItems.map(item => (
                    <button key={item.path} 
                        onClick={() => { router.push(item.path); setIsSidebarOpen(false); }}
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
                borderRadius:'8px', cursor:'pointer', fontWeight:'bold', marginTop:'20px'
            }}>
                تسجيل خروج 🚪
            </button>
          </aside>

          {/* Overlay للموبايل (لإغلاق القائمة عند الضغط في الخارج) */}
          {isSidebarOpen && (
              <div onClick={() => setIsSidebarOpen(false)} style={{
                  position: 'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:40
              }} className="mobile-overlay"></div>
          )}

          {/* Main Content */}
          <main className="main-content" style={{flex:1, padding:'30px', marginRight:'260px', width:'100%'}}>
            {children}
          </main>
      </div>

      {/* CSS Responsive */}
      <style jsx global>{`
        .sidebar {
            width: 260px; background: #1e293b; border-left: 1px solid #334155;
            display: flex; flex-direction: column; padding: 20px;
            position: fixed; right: 0; top: 0; bottom: 0; z-index: 50;
            transition: transform 0.3s ease;
        }
        .close-btn { display: none; }

        @media (max-width: 768px) {
            .mobile-header { display: flex !important; }
            
            .sidebar {
                transform: translateX(100%); /* مخفي افتراضياً لليمين */
                width: 80% !important; max-width: 300px;
                box-shadow: -5px 0 15px rgba(0,0,0,0.5);
            }
            .sidebar.open {
                transform: translateX(0); /* يظهر */
            }
            .close-btn { display: block; }
            
            .main-content {
                margin-right: 0 !important;
                padding: 15px !important;
            }
        }
      `}</style>
    </div>
  );
}
