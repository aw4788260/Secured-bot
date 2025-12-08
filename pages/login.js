import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true); // لانتظار الفحص التلقائي

  // 1. الفحص التلقائي عند فتح الصفحة (Auto-Login)
  useEffect(() => {
    const storedUserId = localStorage.getItem('auth_user_id');
    const hasSessionCookie = document.cookie.includes('student_session');

    if (storedUserId && hasSessionCookie) {
      // إذا وجدنا بيانات، نوجهه للصفحة الرئيسية فوراً
      router.replace('/');
    } else {
      // إذا لم نجد، نعرض فورم الدخول
      setChecking(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 2. توليد البصمة يدوياً (كما طلبت)
      // نبحث أولاً: هل للمتصفح بصمة قديمة؟
      let deviceId = localStorage.getItem('auth_device_id');

      // إذا لم توجد، نولد واحدة جديدة بالمعادلة الخاصة بك
      if (!deviceId) {
          deviceId = 'web-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          // نحفظها لكي تظل ثابتة في المرات القادمة
          localStorage.setItem('auth_device_id', deviceId);
      }

      // إرسال البيانات للسيرفر
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const data = await res.json();

      if (res.ok || data.success) {
        // تخزين بيانات المستخدم
        localStorage.setItem('auth_user_id', data.userId || data.user?.id);
        localStorage.setItem('auth_first_name', data.firstName || data.user?.first_name);
        
        // (deviceId محفوظ بالفعل بالأعلى، لكن لا مانع من تأكيده)
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

  // شاشة انتظار بيضاء لحظية أثناء فحص الدخول التلقائي (لمنع الوميض)
  if (checking) return <div style={{minHeight:'100vh', background:'#0f172a'}}></div>;

  return (
    <div className="login-wrapper">
      <Head><title>تسجيل الدخول</title></Head>
      
      <div className="login-card">
        <div className="icon-header">🔐</div>
        <h1 className="title">تسجيل الدخول</h1>
        <p className="subtitle">منصة التعليم الإلكتروني</p>
        
        {error && <div className="alert-error">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>اسم المستخدم</label>
            <input 
              placeholder="Username" 
              value={username} 
              onChange={e=>setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>كلمة المرور</label>
            <input 
              type="password" 
              placeholder="••••••" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'جاري التحقق...' : 'دخول 🚀'}
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
            border-radius: 20px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 1px solid #334155;
            text-align: center;
        }
        .icon-header { font-size: 3rem; margin-bottom: 10px; }
        .title { color: #f8fafc; margin: 0 0 5px; font-size: 1.8rem; }
        .subtitle { color: #94a3b8; margin-bottom: 30px; font-size: 0.9rem; }
        
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
        .form-group label { display: block; color: #cbd5e1; margin-bottom: 8px; font-size: 0.9rem; font-weight: bold; }
        .form-group input {
            width: 100%;
            padding: 14px;
            background: #0f172a;
            border: 1px solid #475569;
            border-radius: 10px;
            color: white;
            font-size: 1rem;
            transition: 0.2s;
            outline: none;
        }
        .form-group input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1); }
        
        .submit-btn {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            transition: 0.2s;
            margin-top: 10px;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155; color: #94a3b8; font-size: 0.9rem; }
        .link-btn { background: none; border: none; color: #38bdf8; cursor: pointer; font-weight: bold; margin-right: 5px; text-decoration: underline; }
        .link-btn:hover { color: #7dd3fc; }
      `}</style>
    </div>
  );
}
