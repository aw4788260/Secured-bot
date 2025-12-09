import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

export default function AdminHome() {
  const [stats, setStats] = useState({ requests: 0, users: 0, courses: 0, earnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
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
    <AdminLayout title="الرئيسية">
      <h1 style={{marginBottom:'30px', borderBottom:'1px solid #334155', paddingBottom:'15px'}}>أهلاً بك في لوحة التحكم </h1>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'20px'}}>
        
        {/* بطاقة الطلبات */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>الطلبات المعلقة</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#facc15'}}>
                {loading ? '...' : stats.requests}
            </div>
            <p style={{fontSize:'12px', color:'#64748b'}}>بانتظار المراجعة</p>
        </div>

        {/* بطاقة الطلاب */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>إجمالي الطلاب</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#38bdf8'}}>
                {loading ? '...' : stats.users}
            </div>
            <p style={{fontSize:'12px', color:'#64748b'}}>مستخدم نشط</p>
        </div>

        {/* بطاقة الكورسات */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>الكورسات المتاحة</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#4ade80'}}>
                {loading ? '...' : stats.courses}
            </div>
            <p style={{fontSize:'12px', color:'#64748b'}}>كورس تعليمي</p>
        </div>

        {/* --- [جديد] بطاقة الأرباح --- */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'12px', border:'1px solid #334155', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px', fontSize:'0.9em'}}>إجمالي الأرباح</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#f472b6'}}>
                {loading ? '...' : `${stats.earnings} ج.م`}
            </div>
            <p style={{fontSize:'12px', color:'#64748b'}}>من الطلبات المقبولة</p>
        </div>

      </div>
    </AdminLayout>
  );
}
