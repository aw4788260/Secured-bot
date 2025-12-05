import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getDeviceFingerprint } from '../utils/fingerprintHelper';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { localStorage.clear(); }, []); // تنظيف القديم

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const deviceId = await getDeviceFingerprint();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const data = await res.json();

      if (data.success) {
        // ✅ حفظ التوكن محلياً (لن يظهر في الروابط)
        localStorage.setItem('auth_user_id', data.userId);
        localStorage.setItem('auth_device_id', deviceId);
        localStorage.setItem('auth_first_name', data.firstName);
        router.replace('/app');
      } else {
        setError(data.message);
      }
    } catch (err) { setError('خطأ في الاتصال'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="app-container" style={{justifyContent:'center', alignItems:'center'}}>
      <Head><title>تسجيل الدخول</title></Head>
      <div style={{background:'#1e293b', padding:'30px', borderRadius:'10px', width:'100%', maxWidth:'400px', border:'1px solid #334155'}}>
        <h1 style={{textAlign:'center', color:'#38bdf8'}}>تسجيل الدخول</h1>
        {error && <p style={{color:'#ef4444', textAlign:'center'}}>{error}</p>}
        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
          <input placeholder="اسم المستخدم" value={username} onChange={e=>setUsername(e.target.value)} style={{padding:'12px', borderRadius:'5px', border:'none'}} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)} style={{padding:'12px', borderRadius:'5px', border:'none'}} required />
          <button type="submit" disabled={loading} className="button-link" style={{justifyContent:'center', background:'#38bdf8', color:'black'}}>{loading ? '...' : 'دخول'}</button>
        </form>
      </div>
    </div>
  );
}
