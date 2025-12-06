import AdminLayout from '../../components/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { useState, useEffect } from 'react';

export default function AdminHome() {
  const [stats, setStats] = useState({ requests: 0, users: 0, courses: 0 });

  useEffect(() => {
    async function loadStats() {
      // 1. عدد الطلبات المعلقة
      const { count: pendingCount } = await supabase
        .from('subscription_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 2. عدد الطلاب (غير الأدمن)
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', false);

      // 3. عدد الكورسات
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true });

      setStats({ requests: pendingCount || 0, users: usersCount || 0, courses: coursesCount || 0 });
    }
    loadStats();
  }, []);

  return (
    <AdminLayout title="الرئيسية">
      <h1 style={{marginBottom:'30px'}}>أهلاً بك في لوحة التحكم 👋</h1>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'20px'}}>
        
        {/* بطاقة الطلبات */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'10px', border:'1px solid #334155'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px'}}>الطلبات المعلقة</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#facc15'}}>{stats.requests}</div>
            <p style={{fontSize:'12px', color:'#64748b', marginTop:'5px'}}>بانتظار المراجعة</p>
        </div>

        {/* بطاقة الطلاب */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'10px', border:'1px solid #334155'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px'}}>إجمالي الطلاب</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#38bdf8'}}>{stats.users}</div>
            <p style={{fontSize:'12px', color:'#64748b', marginTop:'5px'}}>مستخدم مسجل</p>
        </div>

        {/* بطاقة الكورسات */}
        <div style={{background:'#1e293b', padding:'25px', borderRadius:'10px', border:'1px solid #334155'}}>
            <h3 style={{color:'#94a3b8', marginBottom:'10px'}}>الكورسات النشطة</h3>
            <div style={{fontSize:'32px', fontWeight:'bold', color:'#4ade80'}}>{stats.courses}</div>
            <p style={{fontSize:'12px', color:'#64748b', marginTop:'5px'}}>كورس متاح</p>
        </div>

      </div>
    </AdminLayout>
  );
}
