import TeacherLayout from '../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TeacherDashboard() {
  const router = useRouter();
  
  // 1. حالات الإحصائيات (متوافقة مع API المدرس الجديد)
  const [stats, setStats] = useState({ 
    pendingRequests: 0, 
    students: 0, 
    courses: 0, 
    earnings: 0 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // جلب الإحصائيات من API المدرس الجديد
    fetch('/api/dashboard/teacher/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load stats", err);
        setLoading(false);
      });
  }, []);

  return (
    <TeacherLayout title="الرئيسية">
      <h1 style={{marginBottom:'30px', color:'#fff', borderBottom:'1px solid #334155', paddingBottom:'15px'}}>
        👋 أهلاً بك في لوحة القيادة
      </h1>
      
      {/* --- القسم الأول: الإحصائيات --- */}
      <div className="stats-grid">
        {/* بطاقة الطلبات */}
        <div className="stat-card clickable-card" onClick={() => router.push('/admin/requests')}>
            <h3>الطلبات المعلقة</h3>
            <div className="num yellow">
                {loading ? '...' : stats.pendingRequests}
            </div>
            <p>طلب بانتظار المراجعة</p>
        </div>

        {/* بطاقة الطلاب */}
        <div className="stat-card clickable-card" onClick={() => router.push('/admin/students')}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3>إجمالي الطلاب</h3>
                <span style={{fontSize:'12px', color:'#38bdf8'}}>عرض القائمة 👥</span>
            </div>
            <div className="num blue">
                {loading ? '...' : stats.students}
            </div>
            <p>طالب مسجل لديك</p>
        </div>

        {/* بطاقة الكورسات */}
        <div className="stat-card clickable-card" onClick={() => router.push('/admin/content')}>
            <h3>الكورسات والمحتوى</h3>
            <div className="num green">
                {loading ? '...' : stats.courses}
            </div>
            <p>كورس / مادة</p>
        </div>

        {/* بطاقة الأرباح */}
        <div className="stat-card">
            <h3>إجمالي الأرباح</h3>
            <div className="num pink">
                {loading ? '...' : `${stats.earnings} ج.م`}
            </div>
            <p>أرباحك المباشرة</p>
        </div>
      </div>

      {/* --- القسم الثاني: إجراءات سريعة --- */}
      <div className="shortcuts-panel">
          <h2 className="panel-title">⚡ إجراءات سريعة</h2>
          <div className="shortcuts-grid">
              <button className="shortcut-btn" onClick={() => router.push('/admin/profile')}>
                  💳 تعديل بيانات الدفع والبروفايل
              </button>
              
              <button className="shortcut-btn" onClick={() => router.push('/admin/team')}>
                  👥 إدارة فريق المساعدين
              </button>
              
              <button className="shortcut-btn outline" onClick={() => router.push('/admin/content')}>
                  📚 إضافة محتوى جديد
              </button>
          </div>
      </div>

      <style jsx>{`
        /* تنسيقات الشبكة والبطاقات */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s, border-color 0.2s; }
        .stat-card h3 { color: #94a3b8; margin-bottom: 10px; font-size: 0.9em; margin-top: 0; }
        .stat-card p { font-size: 12px; color: #64748b; margin: 0; }
        
        /* تأثير الضغط للبطاقات */
        .clickable-card { cursor: pointer; position: relative; }
        .clickable-card:hover { transform: translateY(-5px); border-color: #38bdf8; background: #252f45; }
        
        .num { font-size: 32px; fontWeight: bold; margin-bottom: 5px; }
        .num.yellow { color: #facc15; } .num.blue { color: #38bdf8; } .num.green { color: #4ade80; } .num.pink { color: #f472b6; }

        /* تنسيقات قسم الاختصارات */
        .shortcuts-panel { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
        .panel-title { color: #fff; margin-top: 0; margin-bottom: 20px; font-size: 1.2rem; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        
        .shortcuts-grid { display: flex; gap: 15px; flex-wrap: wrap; }
        .shortcut-btn { background: #38bdf8; color: #0f172a; border: none; padding: 15px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1rem; flex: 1; min-width: 200px; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .shortcut-btn:hover { background: #7dd3fc; transform: translateY(-2px); }
        
        .shortcut-btn.outline { background: transparent; border: 2px solid #38bdf8; color: #38bdf8; }
        .shortcut-btn.outline:hover { background: rgba(56, 189, 248, 0.1); }
      `}</style>
    </TeacherLayout>
  );
}
