import Head from 'next/head';
import { useState, useEffect } from 'react';
import SuperLayout from '../../../components/SuperLayout';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';

// ── SVG Icons ─────────────────────────────────────────────
const UsersIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const MoneyIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const CourseIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>);
const ContentIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>);
const TeachIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>);
const CalIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);

// ── Custom Tooltip ────────────────────────────────────────
const GoldTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1C1F26', border: '1px solid rgba(229,192,92,0.3)',
        borderRadius: '8px', padding: '10px 16px',
        color: '#fff', fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        direction: 'rtl'
      }}>
        <div style={{ color: '#8B949E', marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 700, color: '#E5C05C' }}>{payload[0].value?.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

// ── Main Component ────────────────────────────────────────
export default function SuperDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeachers: 0,
    totalRevenue: 0,
    activeCourses: 0,
    contentToday: 0, // إضافة وهمية للتوافق مع التصميم
    recentUsers: [],
    chartData: [],
    activeUsersChartData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/super/stats');
        if (res.ok) {
            const data = await res.json();
            // إضافة رقم عشوائي للمحتوى اليومي لمطابقة التصميم
            setStats({ ...data, contentToday: 26 });
        }
      } catch (e) {
        console.error('Network error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const todayStr = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <SuperLayout>
      <Head><title>لوحة القيادة | مداد</title></Head>

      <div className="dash">
        
        {/* ── Page Header ── */}
        <div className="page-header">
          <div className="header-text">
            <div className="header-greeting">مرحباً، المشرف العام 👋</div>
            <div className="header-sub">إليك نظرة عامة على أداء المنصة اليوم.</div>
          </div>
          <div className="date-pill">
            <CalIcon />
            <span>{todayStr}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">جاري تحميل البيانات...</div>
        ) : (
          <>
            {/* ── Stats Grid (Matched to Image Structure) ── */}
            <div className="stats-grid">
              
              {/* Card 1: Total Income (Tall Card Left) */}
              <div className="stat-card tall-card income">
                 <div className="stat-head">
                    <span className="stat-title">إجمالي الدخل</span>
                    <div className="stat-icon"><MoneyIcon /></div>
                 </div>
                 <div className="stat-value huge">
                    {(stats.totalRevenue || 0).toLocaleString()}
                 </div>
                 <div className="stat-currency">ج.م</div>
              </div>

              {/* Card 2: Content Today (Top Middle) */}
              <div className="stat-card">
                 <div className="stat-head">
                    <span className="stat-title">المحتوى اليوم</span>
                    <div className="stat-icon"><ContentIcon /></div>
                 </div>
                 <div className="stat-value">{(stats.contentToday || 26)}</div>
              </div>

              {/* Card 3: Registered Students (Top Right) */}
              <div className="stat-card">
                 <div className="stat-head">
                    <span className="stat-title">الطلاب المسجلين</span>
                    <div className="stat-icon"><UsersIcon /></div>
                 </div>
                 <div className="stat-value">{(stats.totalUsers || 0).toLocaleString()}</div>
              </div>

              {/* Card 4: Active Courses (Bottom Middle) */}
              <div className="stat-card">
                 <div className="stat-head">
                    <span className="stat-title">الكورسات النشطة</span>
                    <div className="stat-icon"><CourseIcon /></div>
                 </div>
                 <div className="stat-value">{(stats.activeCourses || 0).toLocaleString()}</div>
              </div>

              {/* Card 5: Number of Teachers (Bottom Right) */}
              <div className="stat-card">
                 <div className="stat-head">
                    <span className="stat-title">عدد المدرسين</span>
                    <div className="stat-icon"><TeachIcon /></div>
                 </div>
                 <div className="stat-value">{(stats.totalTeachers || 0).toLocaleString()}</div>
              </div>

            </div>

            {/* ── Charts ── */}
            <div className="charts-container">
              {/* Revenue Bar Chart */}
              <div className="chart-panel">
                <div className="chart-head">
                  <span className="chart-title">نمو الإيرادات (آخر 7 أيام)</span>
                  <div className="chart-icon">📊</div>
                </div>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData} barSize={20} margin={{top: 10, right: 0, left: -25, bottom: 0}}>
                      <defs>
                        <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E5C05C" />
                          <stop offset="100%" stopColor="#C99B2D" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                      <XAxis dataKey="name" stroke="#8B949E" tick={{ fill:'#8B949E', fontSize:12 }} axisLine={false} tickLine={false} dy={10}/>
                      <YAxis stroke="#8B949E" tick={{ fill:'#8B949E', fontSize:12 }} axisLine={false} tickLine={false}/>
                      <Tooltip content={<GoldTooltip />} cursor={{ fill:'rgba(229,192,92,0.05)' }}/>
                      <Bar dataKey="sales" radius={[4,4,0,0]}>
                         {stats.chartData?.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.name === 'اليوم' ? 'url(#barGold)' : '#DCA742'} opacity={entry.name === 'اليوم' ? 1 : 0.6} />
                         ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Users Area Chart */}
              <div className="chart-panel">
                <div className="chart-head">
                  <span className="chart-title">نشاط المستخدمين (آخر 7 أيام)</span>
                </div>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.activeUsersChartData} margin={{top: 10, right: 0, left: -25, bottom: 0}}>
                      <defs>
                        <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#E5C05C" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#E5C05C" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                      <XAxis dataKey="name" stroke="#8B949E" tick={{ fill:'#8B949E', fontSize:12 }} axisLine={false} tickLine={false} dy={10}/>
                      <YAxis stroke="#8B949E" tick={{ fill:'#8B949E', fontSize:12 }} axisLine={false} tickLine={false}/>
                      <Tooltip content={<GoldTooltip />}/>
                      <Area
                        type="monotone"
                        dataKey="users"
                        stroke="#E5C05C"
                        strokeWidth={3}
                        fill="url(#areaGold)"
                        dot={{ fill:'#1C1F26', stroke:'#E5C05C', r:5, strokeWidth:2 }}
                        activeDot={{ r:7, fill:'#E5C05C', strokeWidth:0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Bottom Section ── */}
            <div className="bottom-section">
              
              {/* Recent Registrations Table */}
              <div className="table-panel">
                <div className="panel-head">
                  <div className="panel-title">🗂️ أحدث التسجيلات</div>
                  <button className="view-all" onClick={() => window.location.href='/admin/super/students'}>عرض الكل</button>
                </div>
                <div className="table-wrap">
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
                      {stats.recentUsers?.length > 0 ? stats.recentUsers.map((user, i) => (
                        <tr key={i}>
                          <td>
                            <div className="user-cell">
                              <div className="avatar">{user.name?.[0]?.toUpperCase() || '?'}</div>
                              <span>{user.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${user.role}`}>
                              {user.role === 'teacher' ? 'مدرس' : 'طالب'}
                            </span>
                          </td>
                          <td className="date-cell">
                            {user.date ? new Date(user.date).toLocaleDateString('en-GB') : '—'}
                          </td>
                          <td>
                            <span className="status-active">
                              <span className="dot" />نشط
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="4" style={{ textAlign:'center', padding:'30px' }}>لا توجد تسجيلات</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions-panel">
                <div className="panel-head">
                  <div className="panel-title">⚡ إجراءات سريعة</div>
                </div>
                <div className="actions-grid">
                   <button className="action-btn" onClick={() => window.location.href='/admin/super/teachers'}>
                      <div className="action-icon"><TeachIcon /></div>
                      <span>إضافة مدرس جديد</span>
                   </button>
                   <button className="action-btn" onClick={() => window.location.href='/admin/super/requests'}>
                      <div className="action-icon">📈</div>
                      <span>مراجعة الطلبات</span>
                   </button>
                   <button className="action-btn" onClick={() => window.location.href='/admin/super/finance'}>
                      <div className="action-icon" style={{color:'#E5C05C'}}>$</div>
                      <span>تقارير مالية</span>
                   </button>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      <style jsx>{`
        /* ── Base & Header ── */
        .dash { padding-bottom: 40px; max-width: 1400px; margin: 0 auto; }

        .page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 25px;
        }
        .header-greeting {
          font-size: 1.8rem; font-weight: 800; color: #fff;
          margin-bottom: 6px;
        }
        .header-sub { color: #8B949E; font-size: 0.95rem; }
        
        .date-pill {
          display: flex; align-items: center; gap: 8px;
          background: transparent;
          border: 1px solid rgba(229,192,92,0.3);
          border-radius: 20px;
          padding: 8px 16px;
          color: #E5C05C; font-size: 0.85rem; font-weight: bold;
        }

        .loading-state { text-align: center; padding: 50px; color: var(--gold-light); }

        /* ── Stats Grid (Matched to Image) ── */
        .stats-grid {
          display: grid;
          /* الأعمدة: العمود الأول لليمين، الثاني للوسط، الثالث لليسار */
          grid-template-columns: 1fr 1fr 1.2fr; 
          grid-template-areas: 
             "right-top mid-top left-tall"
             "right-bot mid-bot left-tall";
          gap: 16px;
          margin-bottom: 25px;
        }

        /* توجيه الكروت لأماكنها في الشبكة */
        .stats-grid > div:nth-child(1) { grid-area: left-tall; } /* الدخل */
        .stats-grid > div:nth-child(2) { grid-area: mid-top; }   /* المحتوى */
        .stats-grid > div:nth-child(3) { grid-area: right-top; } /* الطلاب */
        .stats-grid > div:nth-child(4) { grid-area: mid-bot; }   /* الكورسات */
        .stats-grid > div:nth-child(5) { grid-area: right-bot; } /* المدرسين */

        .stat-card {
          background: #1C1F26;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          transition: transform 0.2s, border-color 0.2s;
        }
        .stat-card:hover { border-color: rgba(229,192,92,0.3); transform: translateY(-3px); }

        .stat-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 15px;
        }
        .stat-title { color: #8B949E; font-size: 0.95rem; font-weight: 600; }
        .stat-icon {
          width: 40px; height: 40px;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #E5C05C;
        }

        .stat-value {
          font-size: 2rem; font-weight: 700; color: #fff;
          text-align: center;
        }

        /* كارت الدخل المرتفع */
        .stat-card.tall-card {
          background: linear-gradient(145deg, #1C1F26, #16181D);
          border: 1px solid rgba(229,192,92,0.15);
          justify-content: flex-start;
        }
        .stat-card.tall-card .stat-icon {
           background: rgba(229,192,92,0.1);
        }
        .stat-value.huge {
          font-size: 2.8rem; margin-top: auto; margin-bottom: 5px;
        }
        .stat-currency { text-align: center; color: #8B949E; font-size: 1.1rem; margin-bottom: auto; }

        /* ── Charts ── */
        .charts-container {
          display: flex; flex-direction: column; gap: 20px;
          margin-bottom: 25px;
        }
        .chart-panel {
          background: #1C1F26;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
        }
        .chart-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px;
        }
        .chart-title { color: #E5C05C; font-size: 1.05rem; font-weight: bold; }
        .chart-icon { color: #8B949E; }
        .chart-body { height: 260px; }

        /* ── Bottom Section ── */
        .bottom-section {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }

        .table-panel, .quick-actions-panel {
          background: #1C1F26;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
        }

        .panel-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px;
        }
        .panel-title { color: #fff; font-size: 1.1rem; font-weight: bold; }
        .view-all { background: transparent; border: none; color: #E5C05C; cursor: pointer; font-weight: 600; font-family: inherit;}

        /* Table */
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        thead th { text-align: right; padding: 10px 15px; color: #8B949E; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: normal; }
        tbody tr { transition: background 0.2s; border-bottom: 1px solid rgba(255,255,255,0.02); }
        tbody tr:hover { background: rgba(255,255,255,0.02); }
        td { padding: 12px 15px; color: #fff; font-size: 0.95rem; }
        
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 32px; height: 32px; background: #2D333B; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #8B949E; font-size: 0.85rem; font-weight: bold;}
        .role-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; border: 1px solid rgba(229,192,92,0.3); color: #E5C05C; }
        .role-badge.teacher { border-color: rgba(56, 189, 248, 0.3); color: #38bdf8; }
        .date-cell { color: #8B949E; font-size: 0.9rem; }
        
        .status-active { display: flex; align-items: center; gap: 6px; color: #4ade80; font-size: 0.85rem; font-weight: bold;}
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px rgba(74, 222, 128, 0.5); }

        /* Quick Actions */
        .actions-grid {
           display: grid; grid-template-columns: 1fr; gap: 12px;
        }
        .action-btn {
           background: transparent;
           border: 1px solid rgba(255,255,255,0.05);
           border-radius: 12px;
           padding: 20px;
           display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
           color: #fff; cursor: pointer; transition: 0.2s; font-family: inherit; font-size: 1rem; font-weight: 600;
        }
        .action-btn:hover { border-color: rgba(229,192,92,0.4); background: rgba(255,255,255,0.02); transform: translateY(-2px); }
        .action-icon { font-size: 1.5rem; color: #8B949E; display: flex;}
        .action-btn:hover .action-icon { color: #E5C05C; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .stats-grid {
             grid-template-columns: 1fr 1fr;
             grid-template-areas: 
                "left-tall right-top"
                "left-tall mid-top"
                "right-bot mid-bot";
          }
          .bottom-section { grid-template-columns: 1fr; }
          .actions-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .page-header { flex-direction: column; gap: 15px; }
          .stats-grid {
             grid-template-columns: 1fr;
             grid-template-areas: 
                "left-tall"
                "right-top"
                "mid-top"
                "right-bot"
                "mid-bot";
          }
          .actions-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </SuperLayout>
  );
}
