import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // تنظيف الجلسة عند فتح الصفحة لتجنب التداخل
  useEffect(() => { localStorage.clear(); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // ✅ التعديل هنا: بدلاً من جلب بصمة الجهاز المعقدة، ننشئ معرف جلسة عشوائي
      // هذا المعرف سيتم حفظه في المتصفح لضمان استمرار الدخول
      const sessionDeviceId = `admin_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId: sessionDeviceId })
      });
      const data = await res.json();

      if (data.success) {
        if (!data.isAdmin) {
            setError("⛔ هذا الحساب ليس حساب مسؤول.");
            setLoading(false);
            return;
        }
        
        // ✅ حفظ بيانات الجلسة لكي لا تضطر للدخول كل مرة
        localStorage.setItem('auth_user_id', data.userId);
        localStorage.setItem('auth_device_id', sessionDeviceId); // حفظنا المعرف العشوائي كبصمة
        localStorage.setItem('is_admin_session', 'true');
        
        router.replace('/admin');
      } else {
        setError(data.message);
      }
    } catch (err) {
        setError('خطأ في الاتصال');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh', background:'#0f172a', display:'flex', justifyContent:'center', alignItems:'center', color:'white'}}>
      <Head><title>دخول الإدارة</title></Head>
      <div style={{background:'#1e293b', padding:'40px', borderRadius:'15px', width:'100%', maxWidth:'400px', border:'1px solid #334155', boxShadow:'0 10px 25px rgba(0,0,0,0.5)'}}>
        <h2 style={{textAlign:'center', color:'#38bdf8', marginBottom:'30px'}}>🛡️ لوحة التحكم</h2>
        {error && <div style={{background:'rgba(239,68,68,0.2)', color:'#ef4444', padding:'10px', borderRadius:'5px', marginBottom:'20px', textAlign:'center'}}>{error}</div>}
        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          <div>
            <label style={{display:'block', marginBottom:'8px', color:'#94a3b8'}}>اسم المستخدم</label>
            <input type="text" value={username} onChange={e=>setUsername(e.target.value)} 
              style={{width:'100%', padding:'12px', background:'#0f172a', border:'1px solid #475569', borderRadius:'5px', color:'white', outline:'none'}} required />
          </div>
          <div>
            <label style={{display:'block', marginBottom:'8px', color:'#94a3b8'}}>كلمة المرور</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} 
              style={{width:'100%', padding:'12px', background:'#0f172a', border:'1px solid #475569', borderRadius:'5px', color:'white', outline:'none'}} required />
          </div>
          <button type="submit" disabled={loading} 
            style={{padding:'15px', background:'#38bdf8', border:'none', borderRadius:'5px', color:'#0f172a', fontWeight:'bold', cursor:'pointer', fontSize:'16px', marginTop:'10px'}}>
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
