import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import medaadLogo from '../../styles/medaad-logo.png';

// ─── SVG Icons ──────────────────────────────────────────
const UserIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>);
const LockIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>);
const SunIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>);
const MoonIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>);

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(true);

  // 1. الفحص التلقائي وتهيئة الثيم
  useEffect(() => {
    // استرجاع الثيم المفضل
    const savedTheme = localStorage.getItem('medaad_theme');
    if (savedTheme) setIsDark(savedTheme === 'dark');

    const checkExistingSession = async () => {
      const adminId = localStorage.getItem('admin_user_id');
      const isAdminSession = localStorage.getItem('is_admin_session');

      if (adminId && isAdminSession) {
        try {
          const res = await fetch('/api/auth/check-session', { 
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: adminId, type: 'admin' }) 
          });
            
          if (res.ok) {
             const savedRedirect = localStorage.getItem('admin_redirect');
             router.replace(savedRedirect || '/admin/teacher');
          }
        } catch(e) { }
      }
    };

    checkExistingSession();
  }, []);

  const toggleTheme = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    localStorage.setItem('medaad_theme', newVal ? 'dark' : 'light');
  };

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
        // تنظيف البيانات القديمة
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('is_admin_session');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('admin_redirect');

        // تخزين البيانات الجديدة
        localStorage.setItem('admin_user_id', data.userId);
        localStorage.setItem('is_admin_session', 'true');
        if (data.name) localStorage.setItem('admin_name', data.name);
          
        // تحديد مسار التوجيه بناءً على الدور القادم من السيرفر
        let targetPath = '/admin/teacher'; 
          
        if (data.role === 'super_admin') {
            targetPath = '/admin/super'; 
        }

        // حفظ المسار للمستقبل
        localStorage.setItem('admin_redirect', targetPath);

        // التوجيه
        router.replace(targetPath);
      } else {
        setError(data.message || 'بيانات الدخول غير صحيحة');
      }
    } catch (err) {
        setError('حدث خطأ في الاتصال بالخادم');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className={`login-page ${isDark ? 'dark' : 'light'}`}>
      <Head>
        <title>تسجيل الدخول | إدارة المنصة</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      {/* Theme Toggle Button */}
      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="تبديل المظهر">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Animated Background Elements */}
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>

      <div className="login-container">
        
        <div className="login-card">
          
          {/* Logo Section inside the card for perfect width matching */}
          <div className="logo-wrap">
            <img src={medaadLogo?.src || '/medaad-logo.png'} alt="اللوجو" className="brand-logo" />
          </div>

          <div className="card-header">
            <h2>بوابة الإدارة المركزية</h2>
            <p>يرجى إدخال بيانات الاعتماد للوصول إلى لوحة التحكم</p>
          </div>
          
          {error && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <div className="input-icon"><UserIcon /></div>
              <input 
                  type="text" 
                  placeholder="اسم المستخدم" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required
                  className="login-input ltr" 
              />
            </div>
            
            <div className="input-group">
              <div className="input-icon"><LockIcon /></div>
              <input 
                  type="password" 
                  placeholder="كلمة المرور" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required
                  className="login-input ltr" 
              />
            </div>

            <button type="submit" disabled={loading} className={`submit-btn ${loading ? 'loading' : ''}`}>
              {loading ? <span className="spinner"></span> : 'تسجيل الدخول 🚀'}
            </button>
          </form>
        </div>

        {/* Footer / Privacy Policy */}
        <div className="footer-links">
           <Link href="/privacy-policy" className="privacy-link">
             سياسة الخصوصية (Privacy Policy)
           </Link>
           <p className="copyright">© {new Date().getFullYear()} جميع الحقوق محفوظة.</p>
        </div>

      </div>

      <style jsx global>{`
        /* ── THEME VARIABLES ── */
        .login-page.dark {
          --bg-base:        #111009;
          --bg-surface:     #1a1710;
          --bg-elevated:    #221f13;
          --border:         #3a3420;
          --border-accent:  #5a4e28;
          --gold:           #c9a84c;
          --gold-hover:     #e8c96a;
          --gold-dim:       rgba(201,168,76,0.15);
          --text-primary:   #f5f0e0;
          --text-secondary: #a89f7a;
          --text-muted:     #6b6245;
          --error-bg:       rgba(239, 68, 68, 0.1);
          --error-border:   rgba(239, 68, 68, 0.2);
          --error-text:     #fca5a5;
          --shadow-card:    0 25px 50px -12px rgba(0, 0, 0, 0.7);
          --bg-shape:       rgba(201,168,76,0.03);
        }

        .login-page.light {
          --bg-base:        #faf8f0;
          --bg-surface:     #ffffff;
          --bg-elevated:    #f5f0e0;
          --border:         #ddd4a8;
          --border-accent:  #c9a84c;
          --gold:           #b8903a;
          --gold-hover:     #967228;
          --gold-dim:       rgba(184,144,58,0.12);
          --text-primary:   #1a1508;
          --text-secondary: #6b5a2a;
          --text-muted:     #9e8850;
          --error-bg:       rgba(220, 38, 38, 0.1);
          --error-border:   rgba(220, 38, 38, 0.2);
          --error-text:     #dc2626;
          --shadow-card:    0 20px 40px -10px rgba(184,144,58,0.15);
          --bg-shape:       rgba(184,144,58,0.05);
        }

        body { margin: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }

        /* ── LAYOUT ── */
        .login-page {
          min-height: 100vh;
          background: var(--bg-base);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: var(--text-primary);
          transition: background 0.4s ease, color 0.4s ease;
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        /* ── BACKGROUND ANIMATIONS ── */
        .bg-shape {
          position: absolute;
          border-radius: 50%;
          background: var(--bg-shape);
          filter: blur(80px);
          z-index: 0;
          animation: float 10s infinite ease-in-out alternate;
        }
        .shape-1 { width: 500px; height: 500px; top: -100px; right: -100px; }
        .shape-2 { width: 400px; height: 400px; bottom: -50px; left: -100px; animation-delay: -5s; }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, 40px) scale(1.1); }
        }

        /* ── THEME TOGGLE ── */
        .theme-toggle-btn {
          position: absolute;
          top: 25px; left: 25px;
          background: var(--bg-elevated);
          color: var(--gold);
          border: 1px solid var(--border);
          width: 44px; height: 44px;
          border-radius: 50%;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .theme-toggle-btn:hover {
          transform: rotate(15deg) scale(1.05);
          border-color: var(--gold);
          background: var(--gold-dim);
        }

        /* ── CONTAINER & CARD ── */
        .login-container {
          width: 100%;
          max-width: 440px; /* تم تكبيرها قليلاً لتناسب العرض الجديد */
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-card {
          background: var(--bg-surface);
          padding: 40px 35px;
          border-radius: 24px;
          width: 100%;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
          backdrop-filter: blur(10px);
        }

        /* ── LOGO SECTION ── */
        .logo-wrap {
          width: 100%; /* العرض يطابق المربعات */
          margin-bottom: 25px;
          display: flex;
          justify-content: center;
          animation: logoEntrance 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .brand-logo {
          width: 100%;
          max-height: 110px; /* لضمان عدم زيادة الطول بشكل مفرط */
          object-fit: contain;
          filter: drop-shadow(0 8px 15px rgba(201,168,76,0.25));
        }

        @keyframes logoEntrance {
          from { opacity: 0; transform: scale(0.9) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── HEADER ── */
        .card-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .card-header h2 {
          margin: 0 0 8px 0;
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 800;
        }
        .card-header p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        /* ── ERROR ALERT ── */
        .error-alert {
          background: var(--error-bg);
          color: var(--error-text);
          padding: 14px;
          border-radius: 12px;
          text-align: center;
          margin-bottom: 25px;
          border: 1px solid var(--error-border);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-weight: 600; font-size: 0.9rem;
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        /* ── FORM INPUTS & ANIMATIONS ── */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .input-group {
          position: relative;
          display: flex; 
          align-items: center;
          opacity: 0;
          animation: fadeInUpInput 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        /* تدرج في الظهور لحقول الإدخال */
        .input-group:nth-child(1) { animation-delay: 0.2s; }
        .input-group:nth-child(2) { animation-delay: 0.3s; }

        @keyframes fadeInUpInput {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .input-icon {
          position: absolute;
          right: 16px;
          color: var(--text-muted);
          display: flex;
          transition: color 0.4s;
          pointer-events: none;
          z-index: 2;
        }
        
        .login-input {
          width: 100%;
          padding: 16px 45px 16px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 1rem;
          outline: none;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Bouncy Transition */
          font-family: inherit;
        }
        
        .login-input.ltr { 
          direction: ltr; 
          text-align: left; 
          padding: 16px 16px 16px 45px; 
        }
        .login-input.ltr + .input-icon, .input-group:has(.ltr) .input-icon { 
          right: auto; 
          left: 16px; 
        }
        .login-input::placeholder { color: var(--text-muted); }

        /* تأثير الـ Hover والـ Focus */
        .login-input:hover {
          border-color: var(--border-accent);
        }
        
        .login-input:focus {
          border-color: var(--gold);
          background: var(--bg-surface);
          box-shadow: 0 0 0 4px var(--gold-dim), 0 8px 16px rgba(0,0,0,0.1);
          transform: translateY(-3px); /* ارتفاع المربع للأعلى بلطف */
        }
        
        .login-input:focus ~ .input-icon, .input-group:focus-within .input-icon {
          color: var(--gold);
        }

        /* ── SUBMIT BUTTON ── */
        .submit-btn {
          margin-top: 10px;
          padding: 16px;
          background: var(--gold);
          color: #111009;
          border: none;
          border-radius: 12px;
          font-weight: 800;
          font-size: 1.05rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          opacity: 0;
          animation: fadeInUpInput 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.4s;
        }
        .submit-btn::before {
          content: '';
          position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent);
          transform: skewX(-20deg);
          transition: all 0.5s ease;
        }
        .submit-btn:hover:not(:disabled) {
          background: var(--gold-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(201,168,76,0.3);
        }
        .submit-btn:hover::before { left: 150%; }
        
        .submit-btn:disabled { opacity: 0.7; cursor: wait; transform: none; box-shadow: none; }

        .spinner {
          width: 24px; height: 24px;
          border: 3px solid rgba(17, 16, 9, 0.2);
          border-top-color: #111009;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── FOOTER ── */
        .footer-links {
          margin-top: 30px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: fadeInUpInput 0.6s forwards;
          animation-delay: 0.5s;
          opacity: 0;
        }
        .privacy-link {
          color: var(--text-secondary);
          font-size: 0.9rem;
          text-decoration: none;
          transition: color 0.2s;
          display: inline-block;
          border-bottom: 1px dashed var(--border-accent);
          padding-bottom: 2px;
          font-weight: 600;
        }
        .privacy-link:hover { color: var(--gold); border-color: var(--gold); }
        
        .copyright {
          color: var(--text-muted);
          font-size: 0.8rem;
          margin: 0;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 480px) {
          .login-card { padding: 30px 20px; border-radius: 20px; }
          .card-header h2 { font-size: 1.4rem; }
          .theme-toggle-btn { top: 15px; left: 15px; width: 40px; height: 40px; }
        }
      `}</style>
    </div>
  );
}
