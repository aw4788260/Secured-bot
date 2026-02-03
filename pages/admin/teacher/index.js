import TeacherLayout from '../../../components/TeacherLayout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TeacherDashboard() {
  const router = useRouter();
  
  // الحالة الافتراضية
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // جلب الإحصائيات
    fetch('/api/dashboard/teacher/stats')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json);
        } else {
          console.error("Failed to load stats:", json.error);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Network error:", err);
        setLoading(false);
      });
  }, []);

  // ============================================================
  // تصحيح: استخراج البيانات لتتوافق مع الـ API response
  // ============================================================
  
  // 1. استخدام summary بدلاً من stats
  const stats = data?.summary || { 
    students: 0, 
    earnings: 0, 
    courses: 0, 
    pending: 0 
  };
  
  // 2. استخدام details بدلاً من charts
  const courseDetails = data?.details?.courses || [];
  const subjectDetails = data?.details?.subjects || [];

  return (
    <TeacherLayout title="الرئيسية">
      <h1 style={{marginBottom:'30px', color:'#fff', borderBottom:'1px solid #334155', paddingBottom:'15px'}}>
        👋 أهلاً بك في لوحة القيادة
      </h1>
      
      {/* --- القسم الأول: البطاقات الإحصائية --- */}
      <div className="stats-grid">
        
        {/* بطاقة الطلبات */}
        <div className="stat-card clickable-card" onClick={() => router.push('/admin/teacher/requests')}>
            <h3>الطلبات المعلقة</h3>
            <div className="num yellow">
                {loading ? '...' : stats.pending}
            </div>
            <p>طلب بانتظار المراجعة</p>
        </div>

        {/* بطاقة الطلاب */}
        <div className="stat-card clickable-card" onClick={() => router.push('/admin/teacher/students')}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3>إجمالي الطلاب</h3>
                <span style={{fontSize:'12px', color:'#38bdf8'}}>عرض القائمة 👥</span>
            </div>
            <div className="num blue">
                {loading ? '...' : stats.students}
            </div>
            <p>طالب مسجل (فعلي)</p>
        </div>

        {/* بطاقة الكورسات */}
        <div className="stat-card clickable-card" onClick={() => router.push('/admin/teacher/content')}>
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
                {loading ? '...' : `${stats.earnings.toLocaleString()} ج.م`}
            </div>
            <p>أرباحك المباشرة</p>
        </div>
      </div>

      {/* تم حذف قسم الإجراءات السريعة من هنا */}

      {/* --- القسم الثالث: تفاصيل الأداء --- */}
      {!loading && (courseDetails.length > 0 || subjectDetails.length > 0) && (
        <div className="details-grid">
            <div className="detail-panel">
                <div className="panel-header"><h3>📊 أداء الكورسات</h3></div>
                <div className="list-container">
                    {courseDetails.map((c, i) => (
                        <div key={i} className="list-row">
                            <span>{c.title}</span>
                            <span className="badge">{c.count} طالب</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {subjectDetails.length > 0 && (
                <div className="detail-panel">
                    <div className="panel-header"><h3>📑 أداء المواد</h3></div>
                    <div className="list-container">
                        {subjectDetails.map((s, i) => (
                            <div key={i} className="list-row">
                                <span>{s.title}</span>
                                <span className="badge blue">{s.count} طالب</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      <style jsx>{`
        /* تنسيقات الشبكة والبطاقات */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s, border-color 0.2s; }
        .stat-card h3 { color: #94a3b8; margin-bottom: 10px; font-size: 0.9em; margin-top: 0; }
        .stat-card p { font-size: 12px; color: #64748b; margin: 0; }
        
        /* تأثير الضغط للبطاقات */
        .clickable-card { cursor: pointer; position: relative; }
        .clickable-card:hover { transform: translateY(-5px); border-color: #38bdf8; background: #252f45; }
        
        .num { font-size: 32px; font-weight: bold; margin-bottom: 5px; }
        .num.yellow { color: #facc15; } .num.blue { color: #38bdf8; } .num.green { color: #4ade80; } .num.pink { color: #f472b6; }

        /* تنسيقات الجداول التفصيلية */
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .detail-panel { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
        .panel-header { padding: 15px; background: #162032; border-bottom: 1px solid #334155; }
        .panel-header h3 { margin: 0; font-size: 1rem; color: #e2e8f0; }
        .list-container { padding: 10px; max-height: 300px; overflow-y: auto; }
        .list-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #334155; color: #cbd5e1; }
        .list-row:last-child { border-bottom: none; }
        .badge { background: rgba(168, 85, 247, 0.1); color: #d8b4fe; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; }
        .badge.blue { background: rgba(56, 189, 248, 0.1); color: #7dd3fc; }
      `}</style>
    </TeacherLayout>
  );
}
