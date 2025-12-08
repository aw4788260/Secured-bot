import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // حالة لمنع وميض الفورم أثناء فحص الدخول التلقائي
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 1. الدخول التلقائي (Auto-Login Fix)
  useEffect(() => {
    // نتحقق فقط من وجود المعرف في المتصفح
    // الصفحة الرئيسية (index.js) هي المسؤولة عن التحقق من صلاحية الجلسة فعلياً
    const storedUserId = localStorage.getItem('auth_user_id');

    if (storedUserId) {
      router.replace('/'); 
    } else {
      setIsCheckingAuth(false); // إظهار الفورم
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 2. منطق البصمة (البحث أولاً)
      let deviceId = localStorage.getItem('auth_device_id');

      // فقط إذا لم نجد بصمة قديمة، نولد واحدة جديدة
      if (!deviceId) {
          deviceId = 'web-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          // ونقوم بحفظها فوراً
          localStorage.setItem('auth_device_id', deviceId);
      }

      // إرسال الطلب
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const data = await res.json();

      if (res.ok || data.success) {
        // تحديث البيانات
        localStorage.setItem('auth_user_id', data.userId || data.user?.id);
        localStorage.setItem('auth_first_name', data.firstName || data.user?.first_name);
        // لا داعي لحفظ deviceId هنا لأنه محفوظ بالأعلى، لكن لا ضرر من التأكيد
        localStorage.setItem('auth_device_id', deviceId);
        
        router.push('/');
      } else {
        setError(data.message || data.error || 'بيانات الدخول غير صحيحة');
      }
    } catch (err) { 
        setError('تعذر الاتصال بالسيرفر، تأكد من الإنترنت'); 
    } 
    finally { setLoading(false); }
  };

  // شاشة تحميل بيضاء أثناء فحص الدخول التلقائي
  if (isCheckingAuth) return <div style={{minHeight:'100vh', background:'#0f172a'}}></div>;

  return (
    <div className="login-wrapper">
      <Head><title>تسجيل الدخول</title></Head>
      
      <div className="login-card">
        <div className="icon-box">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h1 className="title">تسجيل الدخول</h1>
        <p className="subtitle">منصة التعليم الإلكتروني</p>
        
        {error && <div className="alert-error">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>اسم المستخدم</label>
            <input 
              type="text"
              value={username} 
              onChange={e=>setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>كلمة المرور</label>
            <input 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>

        <div className="footer">
          <span>ليس لديك حساب؟</span>
          <button onClick={() => router.push('/register')} className="link-btn">
            إنشاء حساب جديد
          </button>
        </div>
      </div>

      <style jsx>{`
        .login-wrapper {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #0f172a;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .login-card {
            background: #1e293b;
            padding: 40px 30px;
            border-radius: 16px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 1px solid #334155;
            text-align: center;
        }
        .icon-box {
            color: #38bdf8;
            margin-bottom: 15px;
            display: inline-block;
            padding: 15px;
            background: rgba(56, 189, 248, 0.1);
            border-radius: 50%;
        }
        .title {
            color: #f8fafc;
            margin: 0 0 5px;
            font-size: 1.6rem;
        }
        .subtitle {
            color: #94a3b8;
            margin-bottom: 30px;
            font-size: 0.9rem;
        }
        
        .alert-error {
            background: rgba(239, 68, 68, 0.1);
            color: #fca5a5;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid rgba(239, 68, 68, 0.2);
            font-size: 0.9rem;
        }
        
        .login-form { display: flex; flex-direction: column; gap: 20px; text-align: right; }
        .form-group label { display: block; color: #cbd5e1; margin-bottom: 8px; font-size: 0.9rem; font-weight: 500; }
        .form-group input {
            width: 100%;
            padding: 12px 15px;
            background: #0f172a;
            border: 1px solid #475569;
            border-radius: 8px;
            color: white;
            font-size: 1rem;
            transition: 0.2s;
            outline: none;
        }
        .form-group input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1); }
        
        .submit-btn {
            background: #38bdf8;
            color: #0f172a;
            border: none;
            padding: 14px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: 0.2s;
            margin-top: 10px;
        }
        .submit-btn:hover:not(:disabled) { background: #7dd3fc; }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155; color: #94a3b8; font-size: 0.9rem; }
        .link-btn { background: none; border: none; color: #38bdf8; cursor: pointer; font-weight: bold; margin-right: 5px; text-decoration: underline; }
        .link-btn:hover { color: #7dd3fc; }
      `}</style>
    </div>
  );
}
