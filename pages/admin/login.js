import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // تنظيف الجلسة المحلية عند الدخول
  useEffect(() => { 
      localStorage.removeItem('auth_user_id');
      localStorage.removeItem('is_admin_session');
      // استدعاء API الخروج لمسح الكوكيز أيضاً
      fetch('/api/auth/logout');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        // نحفظ فقط المعرف والعلامة (للتوجيه)، أما التوكن فهو في الكوكيز الآن
        localStorage.setItem('auth_user_id', data.userId);
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
      <Head><title>دخول الإدارة (Secure)</title></Head>
      <div style={{background:'#1e293b', padding:'40px', borderRadius:'15px', width:'100%', maxWidth:'400px', border:'1px solid #334155'}}>
        <h2 style={{textAlign:'center', color:'#38bdf8', marginBottom:'30px'}}>🛡️ لوحة التحكم</h2>
        {error && <div style={{color:'#ef4444', textAlign:'center', marginBottom:'15px'}}>{error}</div>}
        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          <input placeholder="اسم المستخدم" value={username} onChange={e=>setUsername(e.target.value)} style={{padding:'12px', borderRadius:'5px'}} />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)} style={{padding:'12px', borderRadius:'5px'}} />
          <button type="submit" disabled={loading} style={{padding:'15px', background:'#38bdf8', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
