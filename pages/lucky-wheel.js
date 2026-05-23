import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import fpPromise from '@fingerprintjs/fingerprintjs';

// استيراد الصور من مجلد styles
import medaadLogo from '../styles/medaad-logo.png';
import starsBg from '../styles/stars-bg.jpg';

const Wheel = dynamic(() => import('react-custom-roulette').then(mod => mod.Wheel), { ssr: false });

export default function LuckyWheelPage() {
  const [prizes, setPrizes] = useState([]);
  const [wheelData, setWheelData] = useState([]); // تم حذف البيانات الوهمية
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
        
        // تسجيل حالة التعطيل إذا كانت معطلة (لكننا سنستمر في جلب وعرض الجوائز)
        if (data && data.isWheelEnabled === false) {
            setIsGloballyDisabled(true);
        }

        // جلب وتنسيق الجوائز لتظهر على العجلة في جميع الحالات (مفعلة أو معطلة)
        if (data && data.prizes && data.prizes.length > 0) {
          const activePrizes = data.prizes.filter(p => p.is_active);
          setPrizes(activePrizes);
          
          if(activePrizes.length >= 2) {
            const formattedWheel = activePrizes.map((p, index) => {
                const isGold = index % 2 === 0;
                return {
                    option: p.title,
                    style: { 
                        backgroundColor: isGold ? '#dca742' : '#181818', 
                        textColor: isGold ? '#181818' : '#dca742' 
                    }
                };
            });
            setWheelData(formattedWheel);
          } else {
            // إذا لم يكن هناك جوائز كافية للعجلة
            setIsGloballyDisabled(true);
          }
        } else {
            // إذا لم يكن هناك جوائز من الأساس
            setIsGloballyDisabled(true);
        }
      } catch (e) {
        setErrorMsg('حدث خطأ في تحميل العجلة.');
      } finally {
        setLoading(false);
      }
  };

  const handleSpinClick = async (e) => {
    e.preventDefault();
    if (mustSpin || spinning || hasPlayedLocal || isGloballyDisabled || loading) return;

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

  return (
    <div className="wheel-page">
      <Head><title>عجلة حظ مداد 🎡</title></Head>

      <div className="bg-fixed-layer" style={{ backgroundImage: `url(${starsBg.src})` }}></div>

      <div className="brand-logo">
         <img src={medaadLogo.src} alt="Medaad Logo" />
      </div>

      <div className="split-layout">
        
        {/* ========================================= */}
        {/* القسم الأيمن: النصوص والفورم */}
        {/* ========================================= */}
        <div className="right-panel">
          <h1 className="main-title">جرب حظك واربح!</h1>
          <p className="subtitle">أدخل بياناتك ولف العجلة لتربح جوائز مذهلة</p>

          {errorMsg && <div className="error-alert">⚠️ {errorMsg}</div>}

          {/* في حالة تعطيل المسابقة يظهر كارت التوقف ولا يظهر نموذج إدخال البيانات */}
          {isGloballyDisabled ? (
            <div className="elegant-form-card" style={{ textAlign: 'center', borderColor: '#ef4444' }}>
              <h3 style={{ color: '#ef4444', fontSize: '1.8rem', marginBottom: '15px' }}>🔴 المسابقة متوقفة</h3>
              <p style={{ color: '#cccccc', fontSize: '1.1rem', lineHeight: '1.6' }}>
                عذراً، تم إيقاف عجلة الحظ مؤقتاً. ترقبوا انطلاقها مجدداً قريباً لتتمكنوا من ربح هذه الجوائز الرائعة!
              </p>
            </div>
          ) : !hasPlayedLocal && !mustSpin && !winResult ? (
            <div className="elegant-form-card">
              <h3 className="form-title">شارك الآن</h3>
              <div className="form-divider"><span className="diamond"></span></div>

              <form onSubmit={handleSpinClick} className="spin-form">
                <div className="input-wrapper">
                    <input type="text" placeholder="الاسم الكامل" value={studentName} onChange={e => setStudentName(e.target.value)} required disabled={spinning || loading}/>
                    <span className="input-icon">👤</span>
                </div>
                <div className="input-wrapper">
                    <input type="tel" dir="ltr" placeholder="رقم الهاتف" value={studentPhone} onChange={e => setStudentPhone(e.target.value)} required disabled={spinning || loading}/>
                    <span className="input-icon" style={{left: 'auto', right: '15px'}}>📞</span>
                </div>
                
                <button type="submit" disabled={spinning || loading} className={`spin-btn ${spinning ? 'spinning' : ''}`}>
                  {spinning ? 'جاري السحب...' : loading ? 'تجهيز العجلة...' : 'لف العجلة'}
                </button>
              </form>

              <div className="secure-badge">
                 <span style={{marginRight: '5px'}}>🛡️</span> بياناتك آمنة لدينا ولن يتم مشاركتها مع أي طرف آخر
              </div>
            </div>

          ) : hasPlayedLocal && !winResult ? (
            <div className="already-played-card">
                <h3>شكراً لمشاركتك!</h3>
                <p>لقد قمت بتجربة حظك مسبقاً. 🎉</p>
            </div>
          ) : null}

          {/* كارت الفوز */}
          {winResult && !mustSpin && (
            <div className="result-card">
                <h2>🎉 مبروووك! 🎉</h2>
                <h3>لقد فزت بـ: <span style={{color: '#dca742'}}>{winResult.title}</span></h3>
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
        {/* القسم الأيسر: العجلة */}
        {/* ========================================= */}
        <div className="left-panel">
          <div className="wheel-wrapper">
            {wheelData.length > 0 ? (
              <div className="roulette-box">
                <Wheel
                  mustStartSpinning={mustSpin}
                  prizeNumber={prizeNumber}
                  data={wheelData}
                  onStopSpinning={handleSpinStop}
                  outerBorderColor="#8b5a10"
                  outerBorderWidth={15}
                  innerBorderColor="#dca742"
                  innerBorderWidth={10}
                  radiusLineColor="#8b5a10"
                  radiusLineWidth={3}
                  fontSize={18} // 🎯 حجم خط مثالي للشكل الشعاعي
                  spinDuration={0.8}
                  textDistance={60} // 🎯 تم الإلغاء لـ perpendicular ليأخذ الشكل الطولي الاحترافي، ووضع مسافة 60 لتتمركز الكلمة تماماً
                />
                <div className="wheel-center-btn">
                   {/* تغيير كلمة "لف" لرمز قفل إذا كانت المسابقة معطلة */}
                   <span>{isGloballyDisabled ? '🔒' : 'لف'}</span>
                </div>
              </div>
            ) : (
               <div style={{color: '#dca742', display: loading ? 'block' : 'none'}}>جاري تحميل الجوائز...</div>
            )}
            
            <div className="wheel-stand"></div>
          </div>
        </div>

      </div>

      {/* ========================================= */}
      {/* الفوتر: المميزات */}
      {/* ========================================= */}
      <div className="bottom-features">
          <div className="feature">
              <div className="f-icon">🎁</div>
              <div className="f-text">
                  <strong>جوائز قيمة</strong>
                  <span>بانتظارك</span>
              </div>
          </div>
          <div className="feature">
              <div className="f-icon">⭐</div>
              <div className="f-text">
                  <strong>سهل وسريع</strong>
                  <span>جرب حظك الآن</span>
              </div>
          </div>
          <div className="feature">
              <div className="f-icon">🛡️</div>
              <div className="f-text">
                  <strong>موثوق وآمن</strong>
                  <span>خصوصيتك تهمنا</span>
              </div>
          </div>
      </div>

      <style jsx>{`
        .wheel-page { 
            position: relative;
            min-height: 100vh; 
            width: 100vw;
            background-color: #0d0d0d;
            display: flex; 
            flex-direction: column;
            justify-content: center; 
            align-items: center; 
            padding: 40px 20px 100px 20px; 
            font-family: 'Tajawal', sans-serif; 
            direction: rtl; 
            color: white;
            overflow-x: hidden;
        }

        .bg-fixed-layer {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            z-index: 0;
        }

        .brand-logo {
            position: absolute;
            top: 30px;
            left: 40px;
            z-index: 20;
        }
        .brand-logo img {
            width: 180px;
            height: auto;
            filter: drop-shadow(0 0 10px rgba(220, 167, 66, 0.4));
        }

        .split-layout {
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: row; 
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 1100px;
            gap: 40px;
            margin-top: 20px;
        }

        .right-panel { flex: 1; max-width: 500px; text-align: right; }
        .left-panel { flex: 1; position: relative; display: flex; justify-content: center; align-items: center; }

        .main-title { 
            color: #dca742; 
            margin: 0 0 10px 0; 
            font-size: 3.5rem; 
            font-weight: 900;
            text-shadow: 0 5px 15px rgba(0,0,0,0.8);
            line-height: 1.2;
        }
        .subtitle { color: #cccccc; margin-bottom: 30px; font-size: 1.2rem; }

        .elegant-form-card {
            background: #111111;
            border: 1px solid #dca742;
            border-radius: 20px;
            padding: 35px 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.8);
            transition: all 0.3s;
        }
        .form-title {
            color: #dca742;
            text-align: center;
            font-size: 1.8rem;
            margin: 0 0 10px 0;
        }
        .form-divider {
            text-align: center;
            color: #dca742;
            margin-bottom: 25px;
            font-size: 0.8rem;
            letter-spacing: 5px;
        }
        .form-divider::before, .form-divider::after { content: '♦'; }
        .form-divider .diamond { display: inline-block; width: 8px; height: 8px; background: #dca742; transform: rotate(45deg); margin: 0 15px; }

        .spin-form { display: flex; flex-direction: column; gap: 20px; }
        
        .input-wrapper { position: relative; }
        .input-wrapper input { 
            width: 100%; 
            padding: 16px 45px 16px 16px; 
            border-radius: 12px; 
            border: 1px solid #333333; 
            background: #1a1a1a; 
            color: white; 
            font-size: 1.1rem; 
            outline: none;
            transition: all 0.3s ease;
        }
        .input-wrapper input:focus { border-color: #dca742; box-shadow: 0 0 15px rgba(220, 167, 66, 0.2); }
        .input-wrapper input:disabled { opacity: 0.6; cursor: not-allowed; }
        .input-icon { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #dca742; font-size: 1.2rem; }

        .spin-btn { 
            background: linear-gradient(180deg, #fceebb 0%, #dca742 100%);
            color: #000; 
            border: none; 
            padding: 18px; 
            border-radius: 12px; 
            font-size: 1.6rem; 
            font-weight: 900; 
            cursor: pointer; 
            transition: all 0.3s ease;
            margin-top: 10px;
            box-shadow: 0 10px 20px rgba(220, 167, 66, 0.3); 
        }
        .spin-btn:hover:not(:disabled) { 
            transform: translateY(-3px); 
            box-shadow: 0 15px 30px rgba(220, 167, 66, 0.5); 
            filter: brightness(1.1);
        }
        .spin-btn:disabled { opacity: 0.7; cursor: not-allowed; filter: grayscale(0.5);}
        .spin-btn.spinning { animation: pulseBtn 1s infinite alternate; }

        .secure-badge { margin-top: 25px; text-align: center; color: #888888; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; }

        .wheel-wrapper { position: relative; z-index: 2; padding-bottom: 30px;}
        
        .roulette-box { 
            position: relative;
            transform: scale(1.1);
            border-radius: 50%;
            box-shadow: 0 12px 0px #633f07, 0 25px 40px rgba(0,0,0,0.9);
            z-index: 2;
        }

        .wheel-center-btn {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80px;
            height: 80px;
            background: linear-gradient(180deg, #fceebb 0%, #dca742 100%); 
            border: 4px solid #181818; 
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100;
            box-shadow: 0 5px 15px rgba(0,0,0,0.8);
        }
        .wheel-center-btn span { color: #000; font-weight: 900; font-size: 1.8rem; }

        .wheel-stand {
            position: absolute;
            bottom: 0px;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            height: 40px;
            background: radial-gradient(ellipse at center, #222 0%, #000 100%);
            border-radius: 50%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.9);
            border: 2px solid #dca742;
            border-top: none;
            z-index: 1;
        }

        .error-alert { background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 15px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.4); margin-bottom: 20px; font-weight: bold;}
        .already-played-card { background: #111; padding: 35px; border-radius: 15px; border: 1px dashed #dca742; color: #dca742; text-align: center; }
        .result-card { background: #111; padding: 35px; border-radius: 20px; border: 2px solid #dca742; margin-top: 20px; text-align: center;}
        .coupon-box .code { font-family: monospace; font-size: 2.2rem; font-weight: 900; color: #dca742; margin: 20px 0; background: rgba(220, 167, 66, 0.1); padding: 15px; border-radius: 12px; text-shadow: 0 0 10px rgba(220, 167, 66, 0.4);}

        .bottom-features { position: absolute; bottom: 30px; display: flex; justify-content: center; gap: 50px; width: 100%; z-index: 10; }
        .feature { display: flex; align-items: center; gap: 15px; }
        .f-icon { font-size: 2rem; color: #dca742; }
        .f-text { display: flex; flex-direction: column; text-align: right; }
        .f-text strong { color: #ffffff; font-size: 1.1rem; }
        .f-text span { color: #888888; font-size: 0.9rem; }

        @media (max-width: 900px) {
            .brand-logo { position: relative; top: 0; left: 0; margin-bottom: 20px; text-align: center; width: 100%;}
            .brand-logo img { width: 140px; }
            
            .split-layout { 
                flex-direction: column-reverse; 
                text-align: center;
                gap: 60px;
                margin-top: 0;
            }
            .right-panel { text-align: center; max-width: 100%; }
            .main-title { font-size: 2.5rem; }
            .bottom-features { position: relative; bottom: 0; flex-direction: column; gap: 20px; margin-top: 50px; }
        }

        @keyframes pulseBtn { from { transform: scale(1); } to { transform: scale(1.02); } }
      `}</style>
    </div>
  );
}
