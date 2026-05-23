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
      setFingerprint(result.visitorId);
      checkServerStatus(result.visitorId);
      fetchWheelPrizes();
    };
    initPage();
  }, []);

  const checkServerStatus = async (fp) => {
      try {
          const res = await fetch(`/api/public/check-spin-status?fingerprint=${fp}`);
          const data = await res.json();
          if (data.hasPlayed) { localStorage.setItem('wheel_has_played', 'true'); setHasPlayedLocal(true); }
      } catch (e) {}
  };

  const fetchWheelPrizes = async () => {
      try {
        const res = await fetch('/api/dashboard/super/wheel'); 
        const data = await res.json();
        if (data && data.isWheelEnabled === false) { setIsGloballyDisabled(true); setLoading(false); return; }
        if (data.prizes && data.prizes.length > 0) {
          const activePrizes = data.prizes.filter(p => p.is_active);
          setPrizes(activePrizes);
          const formattedWheel = activePrizes.map((p, index) => ({
              option: p.title,
              style: { backgroundColor: index % 2 === 0 ? '#dca742' : '#181818', textColor: index % 2 === 0 ? '#181818' : '#dca742' }
          }));
          setWheelData(formattedWheel);
        }
      } catch (e) { setErrorMsg('حدث خطأ.'); } finally { setLoading(false); }
  };

  const handleSpinClick = async (e) => {
    e.preventDefault();
    if (mustSpin || spinning || hasPlayedLocal || isGloballyDisabled) return;
    if (!studentName || !studentPhone) return setErrorMsg('يرجى إدخال البيانات.');
    setErrorMsg(''); setSpinning(true);
    try {
      const res = await fetch('/api/public/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentName, studentPhone, fingerprint }) });
      const data = await res.json();
      if (res.ok && data.success) {
        const winningIndex = prizes.findIndex(p => p.id === data.prize.id);
        if (winningIndex !== -1) { setWinResult(data.prize); setPrizeNumber(winningIndex); setMustSpin(true); }
      } else { setErrorMsg(data.error); setSpinning(false); }
    } catch (err) { setErrorMsg('خطأ اتصال'); setSpinning(false); }
  };

  if (loading) return <div className="loader-screen">جاري التجهيز... 🎡</div>;

  return (
    <div className="wheel-page">
      <div className="bg-fixed-layer" style={{ backgroundImage: `url(${starsBg.src})` }}></div>
      <div className="brand-logo"><img src={medaadLogo.src} alt="Medaad Logo" /></div>

      <div className="split-layout">
        <div className="right-panel">
          <h1 className="main-title">جرب حظك واربح!</h1>
          <p className="subtitle">أدخل بياناتك ولف العجلة لتربح جوائز مذهلة</p>
          {errorMsg && <div className="error-alert">{errorMsg}</div>}
          <div className="elegant-form-card">
            <h3 className="form-title">شارك الآن</h3>
            <div className="form-divider"><span className="diamond"></span></div>
            <form onSubmit={handleSpinClick} className="spin-form">
               <input type="text" placeholder="الاسم الكامل" value={studentName} onChange={e => setStudentName(e.target.value)} required disabled={spinning}/>
               <input type="tel" placeholder="رقم الهاتف" value={studentPhone} onChange={e => setStudentPhone(e.target.value)} required disabled={spinning}/>
               <button type="submit" className="spin-btn">لف العجلة</button>
            </form>
          </div>
        </div>

        <div className="left-panel">
          <div className="wheel-wrapper">
            <div className="gold-pointer"></div>
            <div className="roulette-box">
              <Wheel
                mustStartSpinning={mustSpin}
                prizeNumber={prizeNumber}
                data={wheelData}
                onStopSpinning={() => { setMustSpin(false); setSpinning(false); setHasPlayedLocal(true); }}
                outerBorderColor="#dca742" outerBorderWidth={28}
                innerBorderColor="#dca742" innerBorderWidth={18}
                radiusLineColor="#dca742" radiusLineWidth={4}
                textColors={['#ffffff']} fontSize={22} spinDuration={0.8}
              />
              <div className="wheel-center-btn" onClick={handleSpinClick}><span>لف</span></div>
            </div>
            <div className="wheel-stand"></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .wheel-page { position: relative; min-height: 100vh; background-color: #0d0d0d; display: flex; align-items: center; justify-content: center; padding: 40px; direction: rtl; }
        .bg-fixed-layer { position: fixed; inset: 0; background-size: cover; background-position: center; z-index: 0; overflow: hidden; }
        .bg-fixed-layer::after { content:''; position:absolute; inset:0; background: radial-gradient(circle at 20% 50%, rgba(220,167,66,.08), transparent 40%), radial-gradient(circle at 80% 50%, rgba(220,167,66,.08), transparent 40%); }
        .brand-logo { position: absolute; top: 30px; left: 40px; z-index: 20; }
        .brand-logo img { width: 150px; }
        .split-layout { display: flex; max-width: 1100px; width: 100%; gap: 60px; z-index: 10; }
        .right-panel { flex: 1; max-width: 500px; }
        .left-panel { flex: 1; display: flex; justify-content: center; align-items: center; }
        .main-title { color: #dca742; font-size: 3rem; font-weight: 900; }
        .elegant-form-card { background: #111; border: 1px solid #dca742; border-radius: 20px; padding: 30px; }
        .roulette-box { position: relative; transform: scale(1.08); z-index: 2; padding: 25px; border-radius: 50%; background: radial-gradient(circle, #fceebb 0%, #e0b85c 25%, #dca742 60%, #8f6515 100%); box-shadow: 0 0 30px rgba(220,167,66,.45), 0 0 70px rgba(220,167,66,.25); overflow: visible; }
        .gold-pointer{ position:absolute; top:-45px; left:50%; transform:translateX(-50%); width:70px; height:90px; background: linear-gradient(180deg, #fff4d6 0%, #dca742 100%); clip-path: polygon(50% 100%, 0 0, 100% 0); border-radius:15px; z-index:999; box-shadow: 0 0 20px rgba(220,167,66,.5); }
        .wheel-center-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120px; height: 120px; background: linear-gradient(180deg, #fff4d6 0%, #fceebb 20%, #dca742 100%); border: 4px solid #181818; border-radius: 50%; display: flex; justify-content: center; align-items: center; z-index: 100; box-shadow: 0 0 25px rgba(220,167,66,.6), 0 10px 20px rgba(0,0,0,.8); cursor: pointer; }
        .wheel-center-btn span { color: #000; font-weight: 900; font-size: 2.3rem; }
        .wheel-stand{ position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); width:420px; height:60px; background: radial-gradient(ellipse at center, #2a2a2a, #000); border:2px solid #dca742; border-top:none; border-radius:50%; box-shadow: 0 15px 35px rgba(0,0,0,.9); z-index:1; }
        .spin-btn { width: 100%; padding: 18px; background: #dca742; border: none; border-radius: 12px; font-weight: 900; cursor: pointer; font-size: 1.6rem; }
      `}</style>
    </div>
  );
}
