import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link'; // ✅ تم إضافة استيراد مكون الرابط

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. الفحص التلقائي
  useEffect(() => {
    const checkExistingSession = async () => {
      const adminId = localStorage.getItem('admin_user_id');
      const isAdminSession = localStorage.getItem('is_admin_session');

      if (adminId && isAdminSession) {
        try {
          // نتحقق من صحة الجلسة
          const res = await fetch('/api/auth/check-session', { 
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: adminId, type: 'admin' }) 
          });
           
          if (res.ok) {
             // التوجيه للمسار المحفوظ سابقاً أو الافتراضي (تم تحديث الافتراضي هنا أيضاً)
             const savedRedirect = localStorage.getItem('admin_redirect');
             router.replace(savedRedirect || '/admin/teacher');
          }
        } catch(e) { }
      }
    };

    checkExistingSession();
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
        // ✅ 1. تنظيف البيانات القديمة
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('is_admin_session');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('admin_redirect');

        // ✅ 2. تخزين البيانات الجديدة
        localStorage.setItem('admin_user_id', data.userId);
        localStorage.setItem('is_admin_session', 'true');
        if (data.name) localStorage.setItem('admin_name', data.name);
         
        // ✅ 3. تحديد مسار التوجيه بناءً على الدور القادم من السيرفر
        // [تعديل] المسار الافتراضي أصبح /admin/teacher لأن الملفات انتقلت هناك
        let targetPath = '/admin/teacher'; 
         
        if (data.role === 'super_admin') {
            targetPath = '/admin/super'; // مسار السوبر أدمن كما هو
        }

        // حفظ المسار للمستقبل
        localStorage.setItem('admin_redirect', targetPath);

        // التوجيه
        router.replace(targetPath);
      } else {
        setError(data.message || 'بيانات غير صحيحة');
      }
    } catch (err) {
        setError('خطأ في الاتصال بالسيرفر');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh', background:'#0f172a', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', color:'white'}}>
      <Head><title>دخول الإدارة (Secure)</title></Head>
      
      <div style={{background:'#1e293b', padding:'40px', borderRadius:'15px', width:'100%', maxWidth:'400px', border:'1px solid #334155', boxShadow:'0 10px 25px rgba(0,0,0,0.5)'}}>
        <h2 style={{textAlign:'center', color:'#38bdf8', marginBottom:'30px'}}>🛡️ لوحة التحكم</h2>
        
        {error && <div style={{color:'#fca5a5', background:'rgba(239, 68, 68, 0.1)', padding:'10px', borderRadius:'8px', textAlign:'center', marginBottom:'20px', border:'1px solid rgba(239,68,68,0.2)'}}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            <label style={{fontSize:'0.9rem', color:'#cbd5e1'}}>اسم المستخدم</label>
            <input 
                placeholder="Admin Username" 
                value={username} 
                onChange={e=>setUsername(e.target.value)} 
                style={{padding:'12px', borderRadius:'8px', border:'1px solid #475569', background:'#0f172a', color:'white', outline:'none'}} 
            />
          </div>
          
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            <label style={{fontSize:'0.9rem', color:'#cbd5e1'}}>كلمة المرور</label>
            <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                style={{padding:'12px', borderRadius:'8px', border:'1px solid #475569', background:'#0f172a', color:'white', outline:'none'}} 
            />
          </div>

          <button type="submit" disabled={loading} style={{marginTop:'10px', padding:'14px', background:'linear-gradient(135deg, #38bdf8, #3b82f6)', border:'none', borderRadius:'8px', fontWeight:'bold', color:'#0f172a', cursor:'pointer', fontSize:'1rem'}}>
            {loading ? 'جاري التحقق...' : 'دخول للوحة التحكم 🚀'}
          </button>
        </form>
      </div>

      {/* ✅ رابط سياسة الخصوصية لتحسين الامتثال لـ GDPR */}
      <div style={{marginTop: '20px'}}>
         <Link href="/privacy-policy" style={{color: '#64748b', fontSize: '0.9rem', textDecoration: 'none', borderBottom: '1px dashed #64748b'}}>
           سياسة الخصوصية (Privacy Policy)
         </Link>
      </div>

    </div>
  );
}
