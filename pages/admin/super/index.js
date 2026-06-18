import Head from 'next/head';
import { useState, useEffect } from 'react';
import SuperLayout from '../../../components/SuperLayout';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

// ── SVG Icons ─────────────────────────────────────────────
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const MoneyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const CourseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const TeachIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const AddTeachIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);
const ReviewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const ReportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const RegIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <polyline points="16 11 18 13 22 9"/>
  </svg>
);

// ── Custom Tooltip ────────────────────────────────────────
const GoldTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#111', border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: '10px', padding: '10px 16px',
        color: '#f0d080', fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
      }}>
        <div style={{ color: '#7a6535', marginBottom: 4, fontSize: '0.78rem' }}>{label}</div>
        <div style={{ fontWeight: 700 }}>{payload[0].value?.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ label, value, icon, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`stat-card ${visible ? 'visible' : ''}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-shine" />
      <style jsx>{`
        .stat-card {
          position: relative;
          background: #111;
          border: 1px solid rgba(201,168,76,0.15);
          border-radius: 16px;
          padding: 22px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          overflow: hidden;
          cursor: default;
          opacity: 0;
          transform: translateY(16px);
          transition: all 0.45s cubic-bezier(0.4,0,0.2,1);
        }
        .stat-card.visible { opacity: 1; transform: translateY(0); }
        .stat-card:hover {
          border-color: rgba(201,168,76,0.35);
          box-shadow: 0 8px 32px rgba(201,168,76,0.1), 0 0 0 1px rgba(201,168,76,0.08);
          transform: translateY(-3px);
        }
        .stat-icon {
          width: 48px; height: 48px;
          background: rgba(201,168,76,0.1);
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          color: #c9a84c;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .stat-card:hover .stat-icon {
          background: rgba(201,168,76,0.18);
          box-shadow: 0 0 16px rgba(201,168,76,0.2);
        }
        .stat-label {
          font-size: 0.78rem; color: #6b5e45; font-weight: 500;
          margin-bottom: 5px; letter-spacing: 0.02em;
        }
        .stat-value {
          font-size: 1.5rem; font-weight: 800;
          background: linear-gradient(90deg, #f0d080, #c9a84c);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .stat-shine {
          position: absolute; top: 0; left: -80%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(201,168,76,0.04), transparent);
          transform: skewX(-20deg);
          pointer-events: none;
          transition: left 0.6s ease;
        }
        .stat-card:hover .stat-shine { left: 130%; }
      `}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function SuperDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeachers: 0,
    totalRevenue: 0,
    activeCourses: 0,
    activeUsersToday: 0,
    recentUsers: [],
    chartData: [],
    activeUsersChartData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/super/stats');
        if (res.ok) setStats(await res.json());
        else console.error('فشل جلب الإحصائيات:', res.status);
      } catch (e) {
        console.error('Network error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <SuperLayout>
      <Head><title>لوحة التحكم | مداد</title></Head>

      <div className="dash">
        {/* ── Page Header ── */}
        <div className="page-header">
          <div className="header-text">
            <div className="header-greeting">👋 مرحباً، المشرف العام</div>
            <div className="header-sub">إليك نظرة عامة على أداء المنصة اليوم.</div>
          </div>
          <div className="date-pill">
            <CalIcon />
            <span>{today}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-orb" />
            <span>جاري تحميل البيانات...</span>
          </div>
        ) : (
          <>
            {/* ── Stats Grid ── */}
            <div className="stats-grid">
              <StatCard label="الطلاب المسجلين"  value={(stats.totalUsers || 0).toLocaleString()}    icon={<UsersIcon />}    delay={0}   />
              <StatCard label="إجمالي الدخل"      value={`${(stats.totalRevenue || 0).toLocaleString()} ج.م`} icon={<MoneyIcon />}    delay={80}  />
              <StatCard label="الكورسات النشطة"   value={(stats.activeCourses || 0).toLocaleString()}  icon={<CourseIcon />}   delay={160} />
              <StatCard label="النشطون اليوم"     value={(stats.activeUsersToday || 0).toLocaleString()} icon={<ActivityIcon />} delay={240} />
              <StatCard label="عدد المدرسين"       value={(stats.totalTeachers || 0).toLocaleString()}  icon={<TeachIcon />}    delay={320} />
            </div>

            {/* ── Charts ── */}
            <div className="charts-row">
              {/* Revenue Bar Chart */}
              <div className="chart-panel">
                <div className="chart-head">
                  <ReportIcon />
                  <span>نمو الإيرادات — آخر 7 أيام</span>
                </div>
                <div className="chart-body">
                  {stats.chartData?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData} barSize={28}>
                        <defs>
                          <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f0d080" stopOpacity={0.9}/>
                            <stop offset="100%" stopColor="#c9a84c" stopOpacity={0.6}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" vertical={false}/>
                        <XAxis dataKey="name" stroke="#3d3428" tick={{ fill:'#7a6535', fontSize:11 }} axisLine={false} tickLine={false}/>
                        <YAxis stroke="#3d3428" tick={{ fill:'#7a6535', fontSize:11 }} axisLine={false} tickLine={false}/>
                        <Tooltip content={<GoldTooltip />} cursor={{ fill:'rgba(201,168,76,0.05)', radius:6 }}/>
                        <Bar dataKey="sales" fill="url(#barGold)" radius={[6,6,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty">لا توجد بيانات مبيعات</div>
                  )}
                </div>
              </div>

              {/* Users Area Chart */}
              <div className="chart-panel">
                <div className="chart-head">
                  <ActivityIcon />
                  <span>نشاط المستخدمين — آخر 7 أيام</span>
                </div>
                <div className="chart-body">
                  {stats.activeUsersChartData?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.activeUsersChartData}>
                        <defs>
                          <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#c9a84c" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" vertical={false}/>
                        <XAxis dataKey="name" stroke="#3d3428" tick={{ fill:'#7a6535', fontSize:11 }} axisLine={false} tickLine={false}/>
                        <YAxis stroke="#3d3428" tick={{ fill:'#7a6535', fontSize:11 }} axisLine={false} tickLine={false}/>
                        <Tooltip content={<GoldTooltip />}/>
                        <Area
                          type="monotone"
                          dataKey="users"
                          stroke="#c9a84c"
                          strokeWidth={2.5}
                          fill="url(#areaGold)"
                          dot={{ fill:'#c9a84c', r:4, strokeWidth:0 }}
                          activeDot={{ r:6, fill:'#f0d080', strokeWidth:0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty">لا توجد بيانات نشاط</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Bottom Grid ── */}
            <div className="bottom-grid">
              {/* Recent Registrations */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title">
                    <RegIcon />
                    <span>أحدث التسجيلات</span>
                  </div>
                  <button className="view-all" onClick={() => window.location.href='/admin/super/students'}>
                    عرض الكل ←
                  </button>
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
                        <tr key={i} style={{ animationDelay: `${i * 60}ms` }}>
                          <td>
                            <div className="user-cell">
                              <div className="avatar">{user.name?.[0] || '?'}</div>
                              <span>{user.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${user.role === 'teacher' ? 'teacher' : 'student'}`}>
                              {user.role === 'teacher' ? 'مدرس' : 'طالب'}
                            </span>
                          </td>
                          <td className="date-cell">
                            {user.date ? new Date(user.date).toLocaleDateString('ar-EG') : '—'}
                          </td>
                          <td>
                            <span className="status-active">
                              <span className="dot" />نشط
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign:'center', padding:'30px', color:'#3d3428' }}>
                            لا توجد تسجيلات حديثة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="panel actions-panel">
                <div className="panel-head">
                  <div className="panel-title">
                    <span style={{ fontSize:'1rem' }}>⚡</span>
                    <span>إجراءات سريعة</span>
                  </div>
                </div>
                <div className="actions-body">
                  {[
                    { label: 'إضافة مدرس جديد', icon: <AddTeachIcon />, path: '/admin/super/teachers' },
                    { label: 'مراجعة الطلبات',   icon: <ReviewIcon />, path: '/admin/super/requests' },
                    { label: 'تقارير مالية',      icon: <ReportIcon />, path: '/admin/super/finance' },
                  ].map((a, i) => (
                    <button
                      key={i}
                      className="action-btn"
                      onClick={() => window.location.href = a.path}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <span className="action-icon">{a.icon}</span>
                      <span className="action-label">{a.label}</span>
                      <span className="action-arrow">←</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        /* ── Base ── */
        .dash { padding-bottom: 48px; max-width: 1400px; }

        /* ── Header ── */
        .page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(201,168,76,0.12);
        }
        .header-greeting {
          font-size: 1.75rem; font-weight: 800;
          background: linear-gradient(90deg, #f0d080, #c9a84c);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 6px;
        }
        .header-sub { color: #6b5e45; font-size: 0.9rem; }
        .date-pill {
          display: flex; align-items: center; gap: 8px;
          background: rgba(201,168,76,0.07);
          border: 1px solid rgba(201,168,76,0.15);
          border-radius: 20px;
          padding: 8px 16px;
          color: #7a6535; font-size: 0.85rem;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Loading ── */
        .loading-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; padding: 80px; color: #6b5e45;
        }
        .loading-orb {
          width: 44px; height: 44px;
          border: 3px solid rgba(201,168,76,0.1);
          border-top-color: #c9a84c;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Stats Grid ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        /* ── Charts ── */
        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }
        .chart-panel {
          background: #111;
          border: 1px solid rgba(201,168,76,0.12);
          border-radius: 18px;
          padding: 22px;
          transition: border-color 0.2s;
        }
        .chart-panel:hover { border-color: rgba(201,168,76,0.25); }
        .chart-head {
          display: flex; align-items: center; gap: 9px;
          color: #c9a84c; font-size: 0.88rem; font-weight: 700;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(201,168,76,0.08);
        }
        .chart-body { height: 240px; }
        .chart-empty {
          height: 100%; display: flex; align-items: center; justify-content: center;
          color: #3d3428; font-size: 0.88rem;
        }

        /* ── Bottom Grid ── */
        .bottom-grid {
          display: grid;
          grid-template-columns: 3fr 1fr;
          gap: 20px;
        }
        .panel {
          background: #111;
          border: 1px solid rgba(201,168,76,0.12);
          border-radius: 18px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .panel:hover { border-color: rgba(201,168,76,0.22); }
        .panel-head {
          padding: 18px 22px;
          border-bottom: 1px solid rgba(201,168,76,0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .panel-title {
          display: flex; align-items: center; gap: 8px;
          color: #c9a84c; font-size: 0.9rem; font-weight: 700;
        }
        .view-all {
          background: transparent; border: none;
          color: #7a6535; font-size: 0.82rem; cursor: pointer;
          transition: color 0.2s;
          font-family: inherit;
        }
        .view-all:hover { color: #c9a84c; }

        /* ── Table ── */
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        thead th {
          text-align: right;
          padding: 12px 22px;
          font-size: 0.78rem;
          color: #3d3428;
          font-weight: 600;
          background: rgba(201,168,76,0.03);
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        tbody tr {
          border-bottom: 1px solid rgba(201,168,76,0.05);
          transition: background 0.15s;
          animation: rowIn 0.4s ease both;
        }
        @keyframes rowIn { from { opacity:0; transform: translateX(8px); } to { opacity:1; transform:translateX(0); } }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: rgba(201,168,76,0.03); }
        td {
          padding: 13px 22px;
          color: #e8dcc8;
          font-size: 0.88rem;
        }
        .user-cell { display: flex; align-items: center; gap: 10px; }
        .avatar {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.08));
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #c9a84c; font-weight: 800; font-size: 0.85rem;
          flex-shrink: 0;
        }
        .role-badge {
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.76rem; font-weight: 700;
        }
        .role-badge.student {
          background: rgba(201,168,76,0.1); color: #c9a84c;
          border: 1px solid rgba(201,168,76,0.2);
        }
        .role-badge.teacher {
          background: rgba(240,208,128,0.1); color: #f0d080;
          border: 1px solid rgba(240,208,128,0.2);
        }
        .date-cell { color: #6b5e45; font-size: 0.83rem; }
        .status-active {
          display: flex; align-items: center; gap: 6px;
          color: #7a6535; font-size: 0.83rem;
        }
        .dot {
          display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          background: #c9a84c;
          box-shadow: 0 0 6px rgba(201,168,76,0.6);
          animation: blink 2.5s ease-in-out infinite;
        }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.35; } }

        /* ── Quick Actions ── */
        .actions-panel { display: flex; flex-direction: column; }
        .actions-body {
          padding: 16px 14px;
          display: flex; flex-direction: column; gap: 10px;
          flex: 1;
        }
        .action-btn {
          display: flex; align-items: center; gap: 12px;
          width: 100%;
          background: rgba(201,168,76,0.04);
          border: 1px solid rgba(201,168,76,0.12);
          border-radius: 12px;
          padding: 14px 14px;
          color: #7a6535;
          cursor: pointer;
          text-align: right;
          font-size: 0.88rem; font-weight: 600;
          transition: all 0.22s;
          animation: rowIn 0.4s ease both;
          font-family: inherit;
        }
        .action-btn:hover {
          background: rgba(201,168,76,0.1);
          border-color: rgba(201,168,76,0.3);
          color: #c9a84c;
          transform: translateX(-3px);
          box-shadow: 0 4px 16px rgba(201,168,76,0.1);
        }
        .action-icon {
          width: 32px; height: 32px;
          background: rgba(201,168,76,0.08);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .action-btn:hover .action-icon {
          background: rgba(201,168,76,0.18);
          box-shadow: 0 0 10px rgba(201,168,76,0.2);
        }
        .action-label { flex: 1; }
        .action-arrow { color: #3d3428; font-size: 0.8rem; transition: color 0.2s; }
        .action-btn:hover .action-arrow { color: #c9a84c; }

        /* ── Responsive ── */
        @media (max-width: 1280px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 1024px) {
          .charts-row { grid-template-columns: 1fr; }
          .bottom-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .page-header { flex-direction: column; gap: 14px; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .date-pill { align-self: flex-start; }
        }
        @media (max-width: 400px) {
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </SuperLayout>
  );
}
