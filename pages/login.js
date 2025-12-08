import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. تنظيف البيانات القديمة عند فتح الصفحة (لكسر الـ Loop)
  useEffect(() => {
    localStorage.removeItem('auth_user_id');
    localStorage.removeItem('auth_first_name');
    // ملاحظة: لا نمسح auth_device_id لنحافظ على ثبات الجهاز لنفس المتصفح
    
    document.cookie = "student_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 2. منطق البصمة الجديد (داخل الصفحة مباشرة)
      // نبحث أولاً هل توجد بصمة محفوظة؟
      let deviceId = localStorage.getItem('auth_device_id');

      // إذا لم توجد (أول مرة أو تم مسح الكاش)، نولد واحدة جديدة بالمعادلة المطلوبة
      if (!deviceId) {
          deviceId = 'web-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('auth_device_id', deviceId);
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const data = await res.json();

      if (res.ok || data.success) {
        // تخزين البيانات
        localStorage.setItem('auth_user_id', data.userId || data.user?.id);
        // نعيد حفظ الـ deviceId للتأكيد (رغم أنه محفوظ بالأعلى)
        localStorage.setItem('auth_device_id', deviceId);
        localStorage.setItem('auth_first_name', data.firstName || data.user?.first_name);
        
        // التوجيه للمكتبة
        router.push('/');
      } else {
        setError(data.message || data.error || 'بيانات الدخول غير صحيحة');
      }
    } catch (err) { 
        setError('تعذر الاتصال بالسيرفر، تأكد من الإنترنت'); 
    } 
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrapper">
      <Head><title>تسجيل الدخول</title></Head>
      
      <div className="login-card">
        <h1 className="title">تسجيل الدخول</h1>
        <p className="subtitle">منصة التعليم الإلكتروني</p>
        
        {error && <div className="alert-error">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <input 
              placeholder="اسم المستخدم" 
              value={username} 
              onChange={e=>setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <input 
              type="password" 
              placeholder="كلمة المرور" 
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
            padding: 40px;
            border-radius: 16px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            border: 1px solid #334155;
            text-align: center;
        }
        .title {
            color: #f8fafc;
            margin: 0 0 10px;
            font-size: 1.8rem;
        }
        .subtitle {
            color: #94a3b8;
            margin-bottom: 30px;
            font-size: 0.95rem;
        }
        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid rgba(239, 68, 68, 0.3);
            font-size: 0.9rem;
        }
        .login-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .form-group input {
            width: 100%;
            padding: 14px;
            background: #0f172a;
            border: 1px solid #475569;
            border-radius: 8px;
            color: white;
            font-size: 1rem;
            transition: 0.2s;
            outline: none;
        }
        .form-group input:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
        }
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
        .submit-btn:hover:not(:disabled) {
            background: #7dd3fc;
        }
        .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #334155;
            color: #94a3b8;
            font-size: 0.9rem;
        }
        .link-btn {
            background: none;
            border: none;
            color: #38bdf8;
            cursor: pointer;
            font-weight: bold;
            margin-right: 5px;
            text-decoration: underline;
        }
        .link-btn:hover {
            color: #7dd3fc;
        }
      `}</style>
    </div>
  );
}
