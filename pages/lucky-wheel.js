import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import fpPromise from '@fingerprintjs/fingerprintjs';

// استيراد الصور
import medaadLogo from '../styles/medaad-logo.png';
import starsBg from '../styles/stars-bg.jpg';

const Wheel = dynamic(() => import('react-custom-roulette').then(mod => mod.Wheel), { ssr: false });

export default function LuckyWheelPage() {
  const [prizes, setPrizes] = useState([]);
  const [wheelData, setWheelData] = useState([]); 
  const [loading, setLoading] = useState(true);

  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [hasPlayedLocal, setHasPlayedLocal] = useState(false);
  const [isGloballyDisabled, setIsGloballyDisabled] = useState(false);

  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [spinning, setSpinning] = useState(false);
  
  const [winResult, setWinResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const initPage = async () => {
      const fp = await fpPromise.load();
      const result = await fp.get();
      const visitorId = result.visitorId;
      setFingerprint(visitorId);
      
      checkServerStatus(visitorId);
      fetchWheelPrizes();
    };
    initPage();
  }, []);

  const checkServerStatus = async (fp) => {
      try {
          const res = await fetch(`/api/public/check-spin-status?fingerprint=${fp}`);
          const data = await res.json();
          if (data.hasPlayed) {
              localStorage.setItem('wheel_has_played', 'true');
              setHasPlayedLocal(true);
          } else {
              localStorage.removeItem('wheel_has_played');
              setHasPlayedLocal(false);
          }
      } catch (e) {
          if (localStorage.getItem('wheel_has_played')) setHasPlayedLocal(true);
      }
  };

  const fetchWheelPrizes = async () => {
      try {
        const res = await fetch('/api/dashboard/super/wheel'); 
        const data = await res.json();
        
        if (data && data.isWheelEnabled === false) {
            setIsGloballyDisabled(true);
            setLoading(false);
            return;
        }

        if (data.prizes && data.prizes.length > 0) {
          const activePrizes = data.prizes.filter(p => p.is_active);
          setPrizes(activePrizes);
          const formattedWheel = activePrizes.map(p => ({
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

  const handleSpinClick = async (e) => {
    e.preventDefault();
    if (mustSpin || spinning || hasPlayedLocal || isGloballyDisabled) return;

    if (!studentName || !studentPhone) return setErrorMsg('يرجى إدخال اسمك ورقم هاتفك أولاً.');

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
        const winningIndex = prizes.findIndex(p => p.id === data.prize.id);
        if (winningIndex !== -1) {
            setWinResult(data.prize);
            setPrizeNumber(winningIndex);
            setMustSpin(true); 
        } else {
            setErrorMsg('خطأ في مزامنة الجائزة.');
            setSpinning(false);
        }
      } else {
        setErrorMsg(data.error || 'حدث خطأ غير متوقع');
        setSpinning(false);
        if (data.needs_clear) {
            localStorage.removeItem('wheel_has_played');
            setHasPlayedLocal(false);
        }
      }
    } catch (err) {
      setErrorMsg('خطأ في الاتصال بالسيرفر.');
      setSpinning(false);
    }
  };

  const handleSpinStop = () => {
    setMustSpin(false);
    setSpinning(false);
    setHasPlayedLocal(true);
    localStorage.setItem('wheel_has_played', 'true'); 
  };

  if (loading) return <div className="loader-screen">جاري تجهيز عجلة مداد... 🎡</div>;

  if (isGloballyDisabled) {
      return (
          <div className="wheel-page">
              <div className="bg-fixed-layer" style={{ backgroundImage: `url(${starsBg.src})` }}></div>
              <div className="content-container centered">
                  <h1 style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.8)' }}>🔴 المسابقة متوقفة حالياً</h1>
                  <p className="subtitle" style={{ marginTop: '20px' }}>عذراً، تم إيقاف عجلة الحظ مؤقتاً من قِبل إدارة المنصة. ترقبوا انطلاقها مجدداً قريباً!</p>
              </div>
          </div>
      );
  }

  return (
    <div className="wheel-page">
      <Head><title>عجلة حظ مداد 🎡</title></Head>

      {/* 🛑 حل مشكلة الخلفية: طبقة ثابتة تملأ الشاشة بالكامل */}
      <div className="bg-fixed-layer" style={{ backgroundImage: `url(${starsBg.src})` }}></div>

      {/* الحاوية الرئيسية التي تنقسم لقسمين */}
      <div className="split-layout">
        
        {/* ========================================= */}
        {/* القسم الأيمن: النصوص ونموذج الإدخال والنتيجة */}
        {/* ========================================= */}
        <div className="right-panel">
          <h1 className="main-title">
            جرب حظك واربح مع <span className="highlight-medaad">MedaaD</span>
          </h1>
          <p className="subtitle">عجلة الحظ لطلاب منصة مداد. أدخل بياناتك لتبدأ السحب المباشر.</p>

          {errorMsg && <div className="error-alert">⚠️ {errorMsg}</div>}

          {!hasPlayedLocal && !mustSpin && !winResult ? (
            <form onSubmit={handleSpinClick} className="spin-form">
              <input type="text" placeholder="الاسم الثلاثي" value={studentName} onChange={e => setStudentName(e.target.value)} required disabled={spinning}/>
              <input type="tel" dir="ltr" placeholder="رقم الهاتف" value={studentPhone} onChange={e => setStudentPhone(e.target.value)} required disabled={spinning}/>
              <button type="submit" disabled={spinning || wheelData.length === 0} className={`spin-btn ${spinning ? 'spinning' : ''}`}>
                {spinning ? 'جاري السحب...' : 'ابدأ الآن 🎲'}
              </button>
            </form>
          ) : hasPlayedLocal && !winResult ? (
            <div className="already-played">
                <h3>شكراً لمشاركتك! لقد قمت بتجربة حظك مسبقاً. 🎉</h3>
            </div>
          ) : null}

          {winResult && !mustSpin && (
            <div className="result-card" style={{borderColor: winResult.color, boxShadow: `0 0 30px ${winResult.color}80`}}>
                <h2>🎉 مبروووك! 🎉</h2>
                <h3>لقد فزت بـ: <span style={{color: winResult.color}}>{winResult.title}</span></h3>
                {winResult.type === 'coupon' && (
                    <div className="coupon-box">
                        <p>كود الخصم الخاص بك:</p>
                        <div className="code">{winResult.coupon_code}</div>
                        <small>صالح لمدة {winResult.validity_days} يوم. احتفظ به!</small>
                    </div>
                )}
            </div>
          )}
        </div>

        {/* ========================================= */}
        {/* القسم الأيسر: عجلة الحظ المضيئة */}
        {/* ========================================= */}
        <div className="left-panel">
          <div className="background-glow"></div>
          <div className="wheel-wrapper">
            {wheelData.length > 0 ? (
              <div className="roulette-box">
                <Wheel
                  mustStartSpinning={mustSpin}
                  prizeNumber={prizeNumber}
                  data={wheelData}
                  onStopSpinning={handleSpinStop}
                  outerBorderColor="#facc15" 
                  outerBorderWidth={12}
                  innerBorderColor="#0f172a"
                  innerBorderWidth={15}
                  radiusLineColor="#facc15" 
                  radiusLineWidth={3}
                  textColors={['#ffffff']}
                  fontSize={20}
                  spinDuration={0.8}
                />
                <div className="center-logo">
                   <img src={medaadLogo.src} alt="Medaad Logo" />
                </div>
              </div>
            ) : <div className="no-prizes">عذراً، لا توجد جوائز متاحة حالياً.</div>}
          </div>
        </div>

      </div>

      <style jsx>{`
        /* 🎯 الإعدادات الأساسية للصفحة */
        .wheel-page { 
            position: relative;
            min-height: 100vh; 
            width: 100%;
            background-color: #0b1120;
            display: flex; 
            justify-content: center; 
            align-items: center; 
            padding: 40px 20px; 
            font-family: 'Tajawal', sans-serif; 
            direction: rtl; 
            color: white;
            overflow-x: hidden;
        }

        /* 🛑 حل مشكلة الخلفية هنا! طبقة ثابتة تغطي الشاشة 100% مهما كان حجمها */
        .bg-fixed-layer {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            z-index: 0;
            opacity: 0.9;
        }

        /* 🎯 تصميم الشاشة المنقسمة (اليمين واليسار) */
        .split-layout {
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: row; /* في الـ rtl، الـ row يضع العنصر الأول على اليمين والثاني على اليسار تلقائياً */
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 1200px;
            gap: 60px;
        }

        /* تنسيق القسم الأيمن (النموذج والنصوص) */
        .right-panel {
            flex: 1;
            max-width: 550px;
            text-align: right;
        }

        /* تنسيق القسم الأيسر (العجلة) */
        .left-panel {
            flex: 1;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .loader-screen { font-size: 1.5rem; color: #facc15; font-weight: bold; height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b1120; width: 100%; }

        /* النصوص */
        .main-title { 
            color: #ffffff; 
            margin: 0 0 10px 0; 
            font-size: 2.8rem; 
            font-weight: 900;
            text-shadow: 0 2px 10px rgba(0,0,0,0.8);
            line-height: 1.3;
        }
        .highlight-medaad {
            color: #facc15;
            text-shadow: 0 0 20px rgba(250, 204, 21, 0.8);
            font-family: 'Arial', sans-serif;
        }
        .subtitle { color: #cbd5e1; margin-bottom: 40px; font-size: 1.2rem; text-shadow: 0 1px 5px rgba(0,0,0,0.8); line-height: 1.6; }

        /* التوهج والعجلة */
        .background-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 120%;
            height: 120%;
            background: radial-gradient(circle, rgba(234, 179, 8, 0.15) 0%, transparent 60%);
            z-index: 1;
            pointer-events: none;
        }
        .wheel-wrapper { position: relative; z-index: 2; }
        .roulette-box { 
            position: relative;
            transform: scale(1.05);
            filter: drop-shadow(0 0 30px rgba(234, 179, 8, 0.4));
        }

        .center-logo {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90px;
            height: 90px;
            background-color: #0f172a; 
            border: 4px solid #eab308; 
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100;
            box-shadow: 0 0 15px rgba(234, 179, 8, 0.8), inset 0 0 10px rgba(0,0,0,0.9);
        }
        .center-logo img { width: 55px; height: auto; object-fit: contain; }

        /* 🎯 نموذج الإدخال بتأثير الزجاج (Glassmorphism) */
        .spin-form { display: flex; flex-direction: column; gap: 20px; }
        .spin-form input { 
            padding: 18px; 
            border-radius: 12px; 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            background: rgba(15, 23, 42, 0.5); /* زجاجي شفاف */
            color: white; 
            font-size: 1.1rem; 
            text-align: right; 
            outline: none;
            backdrop-filter: blur(15px);
            transition: all 0.3s ease;
        }
        .spin-form input:focus { 
            border-color: #facc15; 
            background: rgba(15, 23, 42, 0.8);
            box-shadow: 0 0 15px rgba(250, 204, 21, 0.3); 
        }

        .spin-btn { 
            background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);
            color: #422006; 
            border: none; 
            padding: 20px; 
            border-radius: 12px; 
            font-size: 1.5rem; 
            font-weight: 900; 
            cursor: pointer; 
            transition: all 0.3s ease;
            box-shadow: 0 10px 25px rgba(202, 138, 4, 0.4); 
        }
        .spin-btn:hover:not(:disabled) { 
            transform: translateY(-3px); 
            box-shadow: 0 15px 35px rgba(250, 204, 21, 0.6); 
            filter: brightness(1.1);
        }
        .spin-btn:disabled { opacity: 0.7; cursor: not-allowed; filter: grayscale(0.7);}
        .spin-btn.spinning { animation: pulseBtn 1s infinite alternate; }

        .error-alert { background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 15px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.4); margin-bottom: 20px; backdrop-filter: blur(5px); font-weight: bold;}
        .already-played { background: rgba(250, 204, 21, 0.1); padding: 25px; border-radius: 15px; border: 1px dashed #facc15; color: #facc15; backdrop-filter: blur(10px); }
        .result-card { background: rgba(15, 23, 42, 0.85); padding: 35px; border-radius: 20px; border: 2px solid; margin-top: 20px; backdrop-filter: blur(15px); }
        .coupon-box .code { font-family: monospace; font-size: 2.2rem; font-weight: 900; color: #4ade80; margin: 20px 0; background: rgba(74, 222, 128, 0.1); padding: 15px; border-radius: 12px; text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);}

        /* 📱 دعم الهواتف المحمولة */
        @media (max-width: 900px) {
            .split-layout { 
                flex-direction: column; /* التكدس فوق بعض في الجوال */
                text-align: center;
                gap: 40px;
            }
            .right-panel { text-align: center; max-width: 100%; }
            .main-title { font-size: 2.2rem; }
        }

        @keyframes pulseBtn { from { transform: scale(1); } to { transform: scale(1.02); } }
      `}</style>
    </div>
  );
}
