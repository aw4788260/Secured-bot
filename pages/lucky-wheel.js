import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import fpPromise from '@fingerprintjs/fingerprintjs';

// منع الرندر على السيرفر (SSR) للعجلة لأنها تعتمد على الويندوز (Browser)
const Wheel = dynamic(() => import('react-custom-roulette').then(mod => mod.Wheel), { ssr: false });

export default function LuckyWheelPage() {
  const [prizes, setPrizes] = useState([]);
  const [wheelData, setWheelData] = useState([]); // البيانات المنسقة لمكتبة العجلة
  const [loading, setLoading] = useState(true);

  // حالة الطالب والفورم
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [hasPlayedLocal, setHasPlayedLocal] = useState(false);

  // حالات العجلة
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [spinning, setSpinning] = useState(false);
  
  // نتيجة الفوز
  const [winResult, setWinResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. التهيئة وجلب البيانات
  useEffect(() => {
    // التحقق مما إذا كان الطالب قد لعب مسبقاً في هذا المتصفح
    if (localStorage.getItem('wheel_has_played')) {
        setHasPlayedLocal(true);
    }

    // توليد بصمة الجهاز
    const loadFingerprint = async () => {
      const fp = await fpPromise.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    };
    loadFingerprint();

    // جلب أجزاء العجلة من السيرفر
    const fetchWheelPrizes = async () => {
      try {
        const res = await fetch('/api/public/wheel-prizes');
        const data = await res.json();
        
        if (data.success && data.prizes.length > 0) {
          setPrizes(data.prizes);
          // تنسيق البيانات لتناسب مكتبة react-custom-roulette
          const formattedWheel = data.prizes.map(p => ({
            option: p.title,
            style: { backgroundColor: p.color, textColor: 'white' }
          }));
          setWheelData(formattedWheel);
        }
      } catch (e) {
        setErrorMsg('حدث خطأ في تحميل العجلة.');
      } finally {
        setLoading(false);
      }
    };
    fetchWheelPrizes();
  }, []);

  // 2. دالة إرسال الطلب للسيرفر والبدء باللف
  const handleSpinClick = async (e) => {
    e.preventDefault();
    if (mustSpin || spinning || hasPlayedLocal) return;

    if (!studentName || !studentPhone) {
        return setErrorMsg('يرجى إدخال اسمك ورقم هاتفك أولاً.');
    }

    setErrorMsg('');
    setSpinning(true);

    try {
      const res = await fetch('/api/public/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, studentPhone, fingerprint })
      });
      
      const data = await res.json();

      if (res.ok && data.success) {
        // حجزنا الجائزة بنجاح، نبحث عن رقمها (index) في المصفوفة لكي تتوقف العجلة عندها
        const winningIndex = prizes.findIndex(p => p.id === data.prize.id);
        
        if (winningIndex !== -1) {
            setWinResult(data.prize);
            setPrizeNumber(winningIndex);
            setMustSpin(true); // هذا الأمر يبدأ بتدوير العجلة فعلياً
        } else {
            setErrorMsg('خطأ في مزامنة الجائزة.');
            setSpinning(false);
        }
      } else {
        setErrorMsg(data.error || 'حدث خطأ غير متوقع');
        setSpinning(false);
        if (data.error === 'تم تسجيل مشاركتك مسبقاً.') {
            localStorage.setItem('wheel_has_played', 'true');
            setHasPlayedLocal(true);
        }
      }
    } catch (err) {
      setErrorMsg('خطأ في الاتصال بالسيرفر. تأكد من الإنترنت.');
      setSpinning(false);
    }
  };

  // 3. هذه الدالة تعمل تلقائياً عندما تتوقف العجلة عن الدوران
  const handleSpinStop = () => {
    setMustSpin(false);
    setSpinning(false);
    setHasPlayedLocal(true);
    localStorage.setItem('wheel_has_played', 'true'); // حفظ في المتصفح
  };

  if (loading) {
      return <div className="loader">جاري تحميل عجلة الحظ... 🎡</div>;
  }

  return (
    <div className="wheel-page">
      <Head><title>عجلة حظ مداد 🎡</title></Head>

      <div className="wheel-container">
        <h1 className="main-title">🎡 جرب حظك واربح مع مداد!</h1>
        <p className="subtitle">أدخل بياناتك، قم بتدوير العجلة، واكسب خصومات وجوائز قيّمة.</p>

        {errorMsg && <div className="error-alert">⚠️ {errorMsg}</div>}

        <div className="wheel-wrapper">
          {wheelData.length > 0 ? (
            <div className="roulette-box">
              <Wheel
                mustStartSpinning={mustSpin}
                prizeNumber={prizeNumber}
                data={wheelData}
                onStopSpinning={handleSpinStop}
                outerBorderColor="#1e293b"
                outerBorderWidth={5}
                innerBorderColor="#0f172a"
                radiusLineColor="#1e293b"
                radiusLineWidth={2}
                textColors={['#ffffff']}
                fontSize={18}
                spinDuration={0.8}
              />
            </div>
          ) : (
             <div className="no-prizes">عذراً، لا توجد جوائز متاحة حالياً.</div>
          )}
        </div>

        {/* نموذج الإدخال (يختفي عندما يبدأ اللعب أو إذا لعب مسبقاً) */}
        {!hasPlayedLocal && !mustSpin && !winResult ? (
          <form onSubmit={handleSpinClick} className="spin-form">
            <input 
                type="text" 
                placeholder="الاسم الثلاثي" 
                value={studentName} 
                onChange={e => setStudentName(e.target.value)} 
                required 
                disabled={spinning}
            />
            <input 
                type="tel" 
                dir="ltr"
                placeholder="رقم الهاتف (مثال: 010xxxxxxxx)" 
                value={studentPhone} 
                onChange={e => setStudentPhone(e.target.value)} 
                required 
                disabled={spinning}
            />
            <button type="submit" disabled={spinning || wheelData.length === 0} className={`spin-btn ${spinning ? 'spinning' : ''}`}>
              {spinning ? 'جاري السحب...' : '🎲 دوّر العجلة الآن!'}
            </button>
          </form>
        ) : hasPlayedLocal && !winResult ? (
          <div className="already-played">
              <h3>شكراً لمشاركتك! لقد قمت بتجربة حظك مسبقاً. 🎉</h3>
          </div>
        )}

        {/* نافذة عرض النتيجة (تظهر بعد التوقف) */}
        {winResult && !mustSpin && (
          <div className="result-card" style={{borderColor: winResult.color}}>
              <h2>🎉 مبروووك! 🎉</h2>
              <h3>لقد فزت بـ: <span style={{color: winResult.color}}>{winResult.title}</span></h3>
              
              {winResult.type === 'coupon' && (
                  <div className="coupon-box">
                      <p>كود الخصم الخاص بك:</p>
                      <div className="code">{winResult.coupon_code}</div>
                      <small>احتفظ بهذا الكود واستخدمه عند شراء الكورس القادم.<br/>صالح لمدة {winResult.validity_days} يوم.</small>
                  </div>
              )}
              
              {winResult.type === 'material' && (
                  <p>تواصل مع الدعم الفني أو المدرس لاستلام جائزتك المادية! 🎁</p>
              )}

              {winResult.type === 'nothing' && (
                  <p>حظ أوفر في المرات القادمة! لا تحزن، انتظر مسابقاتنا القادمة. 💙</p>
              )}
          </div>
        )}

      </div>

      <style jsx>{`
        .wheel-page { min-height: 100vh; background: #0f172a; display: flex; justify-content: center; align-items: center; padding: 20px; font-family: 'Tajawal', sans-serif; direction: rtl; color: white;}
        .loader { font-size: 1.5rem; color: #38bdf8; font-weight: bold; animation: pulse 1s infinite alternate; }
        @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }

        .wheel-container { background: #1e293b; padding: 40px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 600px; width: 100%; text-align: center; border: 1px solid #334155; }
        .main-title { color: #facc15; margin: 0 0 10px 0; font-size: 2rem; }
        .subtitle { color: #cbd5e1; margin-bottom: 30px; line-height: 1.5; }

        .error-alert { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); margin-bottom: 20px; font-weight: bold; }

        .wheel-wrapper { display: flex; justify-content: center; margin-bottom: 30px; position: relative; overflow: hidden;}
        .roulette-box { transform: scale(1.1); margin: 20px 0; } /* تكبير العجلة قليلاً */

        .spin-form { display: flex; flex-direction: column; gap: 15px; }
        .spin-form input { padding: 15px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 1.1rem; outline: none; transition: 0.3s; text-align: center; }
        .spin-form input:focus { border-color: #38bdf8; box-shadow: 0 0 10px rgba(56,189,248,0.2); }
        
        .spin-btn { background: linear-gradient(135deg, #facc15, #f59e0b); color: #422006; border: none; padding: 15px; border-radius: 10px; font-size: 1.3rem; font-weight: 900; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 20px rgba(245, 158, 11, 0.3); }
        .spin-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(245, 158, 11, 0.5); }
        .spin-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .spin-btn.spinning { animation: pulse 1s infinite alternate; }

        .already-played { background: rgba(56, 189, 248, 0.1); padding: 20px; border-radius: 12px; border: 1px dashed #38bdf8; color: #38bdf8; }

        .result-card { background: #0f172a; padding: 30px; border-radius: 16px; border: 2px solid; margin-top: 20px; animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .result-card h2 { margin: 0 0 10px; color: #f8fafc; font-size: 2.5rem; }
        .result-card h3 { margin: 0 0 20px; color: #cbd5e1; }
        
        .coupon-box { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px dashed #475569; }
        .coupon-box .code { font-family: monospace; font-size: 2.5rem; font-weight: 900; color: #4ade80; letter-spacing: 3px; margin: 15px 0; background: rgba(74, 222, 128, 0.1); padding: 10px; border-radius: 8px; }
        .coupon-box small { color: #94a3b8; display: block; line-height: 1.5; }

        .no-prizes { padding: 40px; color: #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 12px; width: 100%; border: 1px dashed #ef4444; }

        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media(max-width: 500px) {
            .wheel-container { padding: 20px; }
            .roulette-box { transform: scale(0.9); }
            .main-title { font-size: 1.5rem; }
            .result-card h2 { font-size: 2rem; }
            .coupon-box .code { font-size: 1.8rem; }
        }
      `}</style>
    </div>
  );
}
