import Head from 'next/head';
import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout'; // تأكد من مسار الـ Layout الصحيح

// أيقونات SVG بسيطة
const Icons = {
  users: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  money: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
  course: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>,
  activity: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
};

export default function SuperDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeachers: 0,
    totalRevenue: 0,
    activeCourses: 0,
    recentUsers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // محاولة جلب البيانات الحقيقية
        const res = await fetch('/api/admin/super/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          // بيانات افتراضية في حال عدم جاهزية الـ API
          setStats({
            totalUsers: 150,
            totalTeachers: 5,
            totalRevenue: 12500,
            activeCourses: 12,
            recentUsers: [
              { id: 1, name: 'أحمد محمد', role: 'student', date: '2024-02-01' },
              { id: 2, name: 'سارة علي', role: 'student', date: '2024-02-01' },
              { id: 3, name: 'أ. محمود حسن', role: 'teacher', date: '2024-01-30' },
            ]
          });
        }
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <AdminLayout>
      <Head>
        <title>لوحة التحكم الرئيسية | Super Admin</title>
      </Head>

      <div className="dashboard-container">
        <header className="page-header">
          <div>
            <h1>👋 مرحباً، المشرف العام</h1>
            <p>إليك نظرة عامة على أداء المنصة اليوم.</p>
          </div>
          <div className="date-badge">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {loading ? (
          <div className="loading-spinner">جاري التحميل...</div>
        ) : (
          <>
            {/* بطاقات الإحصائيات */}
            <div className="stats-grid">
              <div className="stat-card blue">
                <div className="icon">{Icons.users}</div>
                <div className="info">
                  <h3>الطلاب المسجلين</h3>
                  <p>{stats.totalUsers}</p>
                </div>
              </div>

              <div className="stat-card green">
                <div className="icon">{Icons.money}</div>
                <div className="info">
                  <h3>إجمالي الدخل</h3>
                  <p>{stats.totalRevenue.toLocaleString()} ج.م</p>
                </div>
              </div>

              <div className="stat-card purple">
                <div className="icon">{Icons.course}</div>
                <div className="info">
                  <h3>الكورسات النشطة</h3>
                  <p>{stats.activeCourses}</p>
                </div>
              </div>

              <div className="stat-card orange">
                <div className="icon">{Icons.users}</div>
                <div className="info">
                  <h3>عدد المدرسين</h3>
                  <p>{stats.totalTeachers}</p>
                </div>
              </div>
            </div>

            {/* القسم السفلي: جدول وجراف */}
            <div className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>🆕 أحدث التسجيلات</h3>
                  <button className="btn-text">عرض الكل</button>
                </div>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>الدور</th>
                        <th>تاريخ التسجيل</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentUsers.map((user, index) => (
                        <tr key={index}>
                          <td>
                            <div className="user-cell">
                              <div className="avatar-circle">{user.name[0]}</div>
                              <span>{user.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${user.role === 'teacher' ? 'teacher' : 'student'}`}>
                              {user.role === 'teacher' ? 'مدرس' : 'طالب'}
                            </span>
                          </td>
                          <td>{new Date(user.date).toLocaleDateString('ar-EG')}</td>
                          <td><span className="status-dot active"></span> نشط</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel actions-panel">
                <div className="panel-header">
                  <h3>⚡ إجراءات سريعة</h3>
                </div>
                <div className="quick-actions">
                  <button className="action-btn">
                    <span>{Icons.users}</span>
                    إضافة مدرس جديد
                  </button>
                  <button className="action-btn">
                    <span>{Icons.activity}</span>
                    مراجعة الطلبات
                  </button>
                  <button className="action-btn">
                    <span>{Icons.money}</span>
                    تقارير مالية
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .dashboard-container { padding-bottom: 40px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .page-header h1 { margin: 0 0 5px 0; color: #f8fafc; font-size: 1.8rem; }
        .page-header p { margin: 0; color: #94a3b8; }
        .date-badge { background: #1e293b; color: #cbd5e1; padding: 8px 16px; border-radius: 20px; border: 1px solid #334155; font-size: 0.9rem; }
        
        .loading-spinner { text-align: center; padding: 50px; color: #38bdf8; font-size: 1.2rem; }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1e293b; padding: 25px; border-radius: 16px; display: flex; align-items: center; gap: 20px; border: 1px solid #334155; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-5px); border-color: #475569; }
        .stat-card .icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .stat-card .info h3 { margin: 0 0 5px 0; font-size: 0.9rem; color: #94a3b8; font-weight: normal; }
        .stat-card .info p { margin: 0; font-size: 1.5rem; font-weight: bold; color: #f8fafc; }
        
        .stat-card.blue .icon { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .stat-card.green .icon { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .stat-card.purple .icon { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        .stat-card.orange .icon { background: rgba(249, 115, 22, 0.1); color: #f97316; }

        .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .panel { background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; display: flex; flex-direction: column; }
        .panel-header { padding: 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .panel-header h3 { margin: 0; color: #f8fafc; font-size: 1.1rem; }
        .btn-text { background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 0.9rem; }

        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 15px 20px; color: #94a3b8; font-size: 0.85rem; background: #162032; }
        td { padding: 15px 20px; color: #e2e8f0; border-bottom: 1px solid #334155; font-size: 0.95rem; }
        tr:last-child td { border-bottom: none; }
        
        .user-cell { display: flex; align-items: center; gap: 10px; }
        .avatar-circle { width: 32px; height: 32px; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-weight: bold; }
        
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .badge.student { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .badge.teacher { background: rgba(249, 115, 22, 0.1); color: #f97316; }
        
        .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 5px; }
        .status-dot.active { background: #22c55e; }

        .quick-actions { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .action-btn { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; padding: 15px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: 0.2s; text-align: right; font-size: 1rem; }
        .action-btn:hover { border-color: #38bdf8; color: #38bdf8; background: #162032; }
        .action-btn span { color: #94a3b8; }

        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .page-header { flex-direction: column; align-items: flex-start; gap: 15px; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  );
}
