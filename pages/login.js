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

  useEffect(() => { localStorage.clear(); }, []); 

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const deviceId = await getDeviceFingerprint();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const data = await res.json();

      if (data.success) {
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
      <div style={{background:'#1e293b', padding:'30px', borderRadius:'10px', width:'100%', maxWidth:'400px', border:'1px solid #334155', boxShadow:'0 4px 15px rgba(0,0,0,0.5)'}}>
        
        <h1 style={{textAlign:'center', color:'#38bdf8', marginBottom:'20px'}}>تسجيل الدخول</h1>
        
        {error && <div style={{background:'rgba(239,68,68,0.2)', color:'#ef4444', padding:'10px', borderRadius:'5px', marginBottom:'15px', textAlign:'center', border:'1px solid #ef4444'}}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
          <input placeholder="اسم المستخدم" value={username} onChange={e=>setUsername(e.target.value)} style={{padding:'12px', borderRadius:'5px', border:'1px solid #475569', background:'#0f172a', color:'white'}} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)} style={{padding:'12px', borderRadius:'5px', border:'1px solid #475569', background:'#0f172a', color:'white'}} required />
          
          <button type="submit" disabled={loading} className="button-link" style={{justifyContent:'center', background:'#38bdf8', color:'black', fontWeight:'bold'}}>
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول 🔐'}
          </button>
        </form>

        <div style={{marginTop:'25px', paddingTop:'20px', borderTop:'1px solid #334155', textAlign:'center'}}>
          <p style={{color:'#94a3b8', fontSize:'0.9em', marginBottom:'10px'}}>ليس لديك حساب؟</p>
          <button 
            onClick={() => router.push('/register')} 
            style={{
              background: 'transparent', 
              border: '1px solid #38bdf8', 
              color: '#38bdf8', 
              padding: '10px 20px', 
              borderRadius: '5px', 
              cursor: 'pointer',
              fontSize: '0.95em',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(56, 189, 248, 0.1)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📝 طلب اشتراك جديد
          </button>
        </div>

      </div>
    </div>
  );
}
