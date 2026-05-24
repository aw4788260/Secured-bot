import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import fpPromise from '@fingerprintjs/fingerprintjs';

import medaadLogo from '../styles/medaad-logo.png';
import starsBg    from '../styles/stars-bg.jpg';

/* ═══════════════════════════════════════════════════════════
   SpinWheel — Canvas-drawn, matches reference image exactly
═══════════════════════════════════════════════════════════ */
function SpinWheel({ segments, mustSpin, prizeIndex, onSpinStop, disabled }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const state     = useRef({ angle: -Math.PI / 2, spinning: false, targetAngle: 0 });

  /* ── palette ── */
  const GOLD       = '#c8880a';
  const GOLD_LIGHT = '#f0c040';
  const GOLD_MID   = '#dca742';
  const BLACK_SEG  = '#111111';
  const RIM_DARK   = '#7a4e08';
  const HUB_RING   = '#8b5a10';

  /* ══════════════════════════════
     DRAW
  ══════════════════════════════ */
  const draw = useCallback((angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    const cx  = W / 2;
    const cy  = H / 2 - 18;          
    const R   = W / 2 - 14;          
    const n   = segments.length || 6;
    const arc = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, W, H);

    /* ─── 1. Platform / base ─── */
    const bx = cx, by = H - 30, bw = R * 0.72, bh = 22;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
    ctx.strokeStyle = GOLD_MID;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bx, by - 4, bw * 0.65, bh * 0.55, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(220,167,66,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    /* ─── 2. Wheel shadow ─── */
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur    = 40;
    ctx.shadowOffsetY = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    /* ─── 3. Outer gold rim ─── */
    const rimW = R * 0.115;          
    const segR = R - rimW;           

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = RIM_DARK;
    ctx.fill();

    const rimGrad = ctx.createRadialGradient(cx, cy, segR, cx, cy, R);
    rimGrad.addColorStop(0,   '#b07010');
    rimGrad.addColorStop(0.3, GOLD_LIGHT);
    rimGrad.addColorStop(0.6, GOLD_MID);
    rimGrad.addColorStop(1,   RIM_DARK);
    ctx.beginPath();
    ctx.arc(cx, cy, R,     0, Math.PI * 2);
    ctx.arc(cx, cy, segR + 2, 0, Math.PI * 2, true);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    /* ─── 4. Rivet / stud dots on rim ─── */
    const studR     = rimW * 0.22;
    const studRing  = segR + rimW * 0.5;
    const studCount = Math.max(12, n * 3);
    for (let i = 0; i < studCount; i++) {
      const a  = (Math.PI * 2 * i) / studCount;
      const sx = cx + Math.cos(a) * studRing;
      const sy = cy + Math.sin(a) * studRing;
      ctx.beginPath();
      ctx.arc(sx, sy, studR, 0, Math.PI * 2);
      ctx.fillStyle = '#f5e08a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + studR * 0.4, sy + studR * 0.4, studR * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
    }

    /* ─── 5. Segments ─── */
    for (let i = 0; i < n; i++) {
      const start  = angle + i * arc;
      const end    = start + arc;
      const isGold = i % 2 === 0;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, segR, start, end);
      ctx.closePath();

      if (isGold) {
        const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, segR);
        sg.addColorStop(0,   '#e8b84b');
        sg.addColorStop(0.5, GOLD_MID);
        sg.addColorStop(1,   '#a06808');
        ctx.fillStyle = sg;
      } else {
        ctx.fillStyle = BLACK_SEG;
      }
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, segR, start, end);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    /* ─── 6. Segment text ─── */
    for (let i = 0; i < n; i++) {
      const start    = angle + i * arc;
      const midAngle = start + arc / 2;
      const isGold   = i % 2 === 0;
      const textR    = segR * 0.60;   
      const tx       = cx + Math.cos(midAngle) * textR;
      const ty       = cy + Math.sin(midAngle) * textR;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);

      const label  = (segments[i] && segments[i].option) ? segments[i].option : '';
      const fsize  = Math.max(10, Math.min(14, 280 / n));
      ctx.font     = `bold ${fsize}px Tajawal, Arial, sans-serif`;
      ctx.fillStyle    = isGold ? '#111' : GOLD_MID;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      const maxW  = arc * segR * 0.72;
      const words = label.split(' ');
      let line1 = '', line2 = '', built = '', wrapped = false;
      for (const w of words) {
        const test = built ? built + ' ' + w : w;
        if (!wrapped && ctx.measureText(test).width > maxW) {
          line1   = built; built = w; wrapped = true;
        } else { built = test; }
      }
      if (wrapped) {
        line2 = built;
        ctx.fillText(line1, 0, -fsize * 0.65);
        ctx.fillText(line2, 0,  fsize * 0.65);
      } else {
        ctx.fillText(built, 0, 0);
      }
      ctx.restore();
    }

    /* ─── 7. Hub (centre circle) ─── */
    const hubR  = segR * 0.14;
    const hub2  = hubR * 1.45;

    const ringGrad = ctx.createRadialGradient(cx - hub2*0.2, cy - hub2*0.2, 1, cx, cy, hub2);
    ringGrad.addColorStop(0,   GOLD_LIGHT);
    ringGrad.addColorStop(0.5, GOLD_MID);
    ringGrad.addColorStop(1,   RIM_DARK);
    ctx.beginPath();
    ctx.arc(cx, cy, hub2, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();
    ctx.strokeStyle = HUB_RING;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    const domeGrad = ctx.createRadialGradient(cx - hubR*0.35, cy - hubR*0.4, 1, cx, cy, hubR);
    domeGrad.addColorStop(0,   '#fff8d0');
    domeGrad.addColorStop(0.3, GOLD_LIGHT);
    domeGrad.addColorStop(0.7, GOLD_MID);
    domeGrad.addColorStop(1,   '#7a4e08');
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fillStyle = domeGrad;
    ctx.fill();

    ctx.font      = `bold ${Math.max(9, hubR * 0.65)}px Tajawal, Arial`;
    ctx.fillStyle = '#3a2800';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(disabled ? '🔒' : '🎁', cx, cy + 1);

    /* ─── 8. Teardrop pointer at top ─── */
    const pTipY  = cy - R + 2;       
    const pBaseY = pTipY + 44;
    const pW     = 18;               

    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur    = 10;
    ctx.shadowOffsetY = 3;

    const tGrad = ctx.createLinearGradient(cx - pW, pTipY, cx + pW, pBaseY);
    tGrad.addColorStop(0,   GOLD_LIGHT);
    tGrad.addColorStop(0.4, GOLD_MID);
    tGrad.addColorStop(1,   RIM_DARK);
    ctx.beginPath();
    ctx.moveTo(cx, pTipY);
    ctx.bezierCurveTo(cx + pW, pTipY + 12, cx + pW, pBaseY - 8, cx, pBaseY);
    ctx.bezierCurveTo(cx - pW, pBaseY - 8, cx - pW, pTipY + 12, cx, pTipY);
    ctx.fillStyle = tGrad;
    ctx.fill();
    ctx.strokeStyle = RIM_DARK;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    const holeR = pW * 0.38;
    const holeY = pTipY + 28;
    ctx.beginPath();
    ctx.arc(cx, holeY, holeR, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d0d';
    ctx.fill();
    ctx.strokeStyle = GOLD_MID;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

  }, [segments, disabled]);

  /* ── trigger spin (Fixed Physics) ── */
  useEffect(() => {
    if (!mustSpin || !segments.length) return;

    const n         = segments.length;
    const arc       = (Math.PI * 2) / n;
    
    const winMid    = prizeIndex * arc + arc / 2;
    const baseTarget = -Math.PI / 2 - winMid;

    const extraSpins = Math.PI * 2 * (5 + Math.floor(Math.random() * 3));
    
    let finalTarget = baseTarget;
    while (finalTarget <= state.current.angle) {
        finalTarget += Math.PI * 2;
    }
    finalTarget += extraSpins;

    state.current.targetAngle = finalTarget;
    state.current.spinning = true;

    const duration = 10000; 
    const start = performance.now();
    const startAngle = state.current.angle;
    const changeInAngle = finalTarget - startAngle;

    const animate = (time) => {
      let elapsed = time - start;
      if (elapsed > duration) elapsed = duration;

      const t = elapsed / duration;
      const ease = 1 - Math.pow(1 - t, 4);

      state.current.angle = startAngle + changeInAngle * ease;
      draw(state.current.angle);

      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        state.current.spinning = false;
        state.current.angle = state.current.angle % (Math.PI * 2);
        onSpinStop();
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [mustSpin, segments.length, prizeIndex, draw, onSpinStop]);

  /* ── initial draw ── */
  useEffect(() => {
    if (segments.length) draw(state.current.angle);
  }, [segments, draw]);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} width={400} height={440} className="wheel-canvas" />
      <style jsx>{`
        .canvas-wrap   { position: relative; display: flex; flex-direction: column; align-items: center; }
        .wheel-canvas  { display: block; filter: ${disabled ? 'grayscale(0.5) brightness(0.75)' : 'none'}; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════ */
export default function LuckyWheelPage() {
  const [prizes, setPrizes]                         = useState([]);
  const [wheelData, setWheelData]                   = useState([]);
  const [loading, setLoading]                       = useState(true);

  const [studentName, setStudentName]               = useState('');
  const [studentPhone, setStudentPhone]             = useState('');
  const [fingerprint, setFingerprint]               = useState('');
  const [hasPlayedLocal, setHasPlayedLocal]         = useState(false);
  const [isGloballyDisabled, setIsGloballyDisabled] = useState(false);

  const [mustSpin, setMustSpin]       = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [spinning, setSpinning]       = useState(false);

  const [winResult, setWinResult]     = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [copied, setCopied]           = useState(false);

  useEffect(() => {
    const initPage = async () => {
      const fp        = await fpPromise.load();
      const result    = await fp.get();
      const visitorId = result.visitorId;
      setFingerprint(visitorId);
      checkServerStatus(visitorId);
      fetchWheelPrizes();
    };
    initPage();
  }, []);

  const checkServerStatus = async (fp) => {
    try {
      const res  = await fetch(`/api/public/check-spin-status?fingerprint=${fp}`);
      const data = await res.json();
      if (data.hasPlayed) { localStorage.setItem('wheel_has_played','true'); setHasPlayedLocal(true); }
      else                { localStorage.removeItem('wheel_has_played');     setHasPlayedLocal(false); }
    } catch {
      if (localStorage.getItem('wheel_has_played')) setHasPlayedLocal(true);
    }
  };

  const fetchWheelPrizes = async () => {
    try {
      const res  = await fetch('/api/public/wheel-prizes');
      const data = await res.json();
      
      if (data?.isWheelEnabled === false) {
          setIsGloballyDisabled(true);
      } else if (data?.prizes?.length > 0) {
        const active = data.prizes; 
        setPrizes(active);
        if (active.length >= 2) {
          setWheelData(active.map((p, i) => ({
            option: p.title,
            style: { backgroundColor: i%2===0 ? '#dca742':'#181818', textColor: i%2===0 ? '#181818':'#dca742' },
          })));
        } else {
            setIsGloballyDisabled(true);
        }
      } else {
          setIsGloballyDisabled(true);
      }
    } catch { 
        setErrorMsg('حدث خطأ في تحميل العجلة.'); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleSpinClick = async (e) => {
    e.preventDefault();
    if (mustSpin || spinning || hasPlayedLocal || isGloballyDisabled || loading) return;
    if (!studentName || !studentPhone) return setErrorMsg('يرجى إدخال اسمك ورقم هاتفك أولاً.');
    setErrorMsg(''); setSpinning(true);
    try {
      const res  = await fetch('/api/public/spin', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ studentName, studentPhone, fingerprint }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const idx = prizes.findIndex(p => p.id === data.prize.id);
        if (idx !== -1) { setWinResult(data.prize); setPrizeNumber(idx); setMustSpin(true); }
        else { setErrorMsg('خطأ في مزامنة الجائزة.'); setSpinning(false); }
      } else {
        setErrorMsg(data.error || 'حدث خطأ غير متوقع');
        setSpinning(false);
        if (data.needs_clear) { localStorage.removeItem('wheel_has_played'); setHasPlayedLocal(false); }
      }
    } catch { setErrorMsg('خطأ في الاتصال بالسيرفر.'); setSpinning(false); }
  };

  const handleSpinStop = useCallback(() => {
    setMustSpin(false); 
    setSpinning(false); 
    setHasPlayedLocal(true);
    localStorage.setItem('wheel_has_played','true');
  }, []);

  const handleCopyCoupon = async (code) => {
    try { await navigator.clipboard.writeText(code); }
    catch {
      const el = document.createElement('textarea');
      el.value = code; el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="wheel-page">
      <Head><title>عجلة حظ مداد 🎡</title></Head>

      <div className="bg-fixed-layer" style={{ backgroundImage:`url(${starsBg.src})` }} />

      <div className="brand-logo">
        <img src={medaadLogo.src} alt="Medaad Logo" />
      </div>

      <div className="split-layout">

        {/* ══ RIGHT – form ══ */}
        <div className="right-panel">
          <h1 className="main-title">جرب حظك واربح!</h1>
          <p className="subtitle">أدخل بياناتك ولف العجلة لتربح جوائز مذهلة</p>

          {errorMsg && <div className="error-alert">⚠️ {errorMsg}</div>}

          {isGloballyDisabled ? (
            <div className="elegant-form-card" style={{textAlign:'center',borderColor:'#ef4444'}}>
              <h3 style={{color:'#ef4444',fontSize:'1.8rem',marginBottom:'15px'}}>🔴 المسابقة متوقفة</h3>
              <p style={{color:'#cccccc',fontSize:'1.1rem',lineHeight:'1.6'}}>
                عذراً، تم إيقاف عجلة الحظ مؤقتاً. ترقبوا انطلاقها مجدداً قريباً!
              </p>
            </div>
          ) : !hasPlayedLocal && !mustSpin && !winResult ? (
            <div className="elegant-form-card">
              <h3 className="form-title">شارك الآن</h3>
              <div className="form-divider"><span className="diamond" /></div>
              <form onSubmit={handleSpinClick} className="spin-form">
                <div className="input-wrapper">
                  <input type="text" placeholder="الاسم الكامل"
                    value={studentName} onChange={e=>setStudentName(e.target.value)}
                    required disabled={spinning||loading} />
                  <span className="input-icon">👤</span>
                </div>
                <div className="input-wrapper">
                  <input type="tel" dir="ltr" placeholder="رقم الهاتف"
                    value={studentPhone} onChange={e=>setStudentPhone(e.target.value)}
                    required disabled={spinning||loading} />
                  <span className="input-icon" style={{left:'auto',right:'15px'}}>📞</span>
                </div>
                <button type="submit" disabled={spinning||loading}
                  className={`spin-btn ${spinning?'spinning':''}`}>
                  {spinning ? 'جاري السحب...' : loading ? 'تجهيز العجلة...' : 'لف العجلة 🎡'}
                </button>
              </form>
              <div className="secure-badge">
                <span style={{marginRight:'5px'}}>🛡️</span>
                بياناتك آمنة لدينا ولن يتم مشاركتها مع أي طرف آخر
              </div>
            </div>
          ) : hasPlayedLocal && !winResult ? (
            <div className="already-played-card">
              <h3>شكراً لمشاركتك!</h3>
              <p>لقد قمت بتجربة حظك مسبقاً. 🎉</p>
            </div>
          ) : null}

          {/* ── Win card ── */}
          {winResult && !mustSpin && (
            <div className="result-card">
              <div className="confetti-emoji">🎉</div>
              
              {/* تعديل العنوان إذا كان حظ أوفر أو فوز */}
              <h2 className="congrats-title">
                {winResult.type === 'nothing' ? 'لا بأس!' : 'مبروووك!'}
              </h2>

              {/* 1. بيانات الطالب والجائزة المدمجة */}
              <div className="student-details-box">
                  <p><strong>الاسم:</strong> {studentName}</p>
                  <p><strong>رقم الهاتف:</strong> <span dir="ltr">{studentPhone}</span></p>
                  <p>
                    <strong>{winResult.type === 'nothing' ? 'النتيجة:' : 'الجائزة:'}</strong> 
                    <span className="prize-name"> {winResult.title}</span>
                  </p>
              </div>

              {/* إخفاء تحذير السكرين شوت في حالة عدم الفوز */}
              {winResult.type !== 'nothing' && (
                <div className="screenshot-alert">
                  📸 <strong>هام جداً:</strong> يرجى أخذ لقطة شاشة (سكرين شوت) لهذه البيانات فوراً للاحتفاظ بها!
                </div>
              )}

              {/* 3. حالة الكوبون وخطوات الاستخدام */}
              {winResult.type === 'coupon' && (
                <>
                  <div className="coupon-box">
                    <p className="coupon-label">🎟️ كود الخصم الخاص بك</p>
                    <div className="copy-wrapper">
                      <div className="code-display">{winResult.coupon_code}</div>
                      <button className={`copy-btn ${copied?'copied':''}`}
                        onClick={()=>handleCopyCoupon(winResult.coupon_code)}>
                        {copied ? (
                          <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>تم النسخ!</>
                        ) : (
                          <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>انسخ الكود</>
                        )}
                      </button>
                    </div>
                    {/* تعديل لون مدة الصلاحية إلى الأحمر */}
                    <div className="red-validity">
                        ⏳ صالح لمدة {winResult.validity_days} يوم
                    </div>
                  </div>

                  <div className="instructions-box">
                     <h4>خطوات استخدام الجائزة:</h4>
                     <ol>
                       <li>
                         قم بتنزيل تطبيق مداد:
                         <div className="app-download-links">
                           <a href="https://play.google.com/store/apps/details?id=medaad.app.com" target="_blank" rel="noreferrer">أندرويد</a>
                           <a href="https://apps.apple.com/eg/app/medaad-%D9%85%D9%80%D9%80%D9%80%D8%AF%D8%A7%D8%AF/id6758565779" target="_blank" rel="noreferrer">آيفون</a>
                         </div>
                       </li>
                       <li>قم بإنشاء حساب باستخدام <strong>نفس الاسم</strong> ونفس <strong>رقم الهاتف</strong>.</li>
                       <li>قم بتسجيل الدخول في التطبيق.</li>
                       <li>اختر الكورس المراد شرائه.</li>
                       <li>اذهب لصفحة الدفع (Checkout).</li>
                       <li>سيطلب منك وضع كوبون الخصم، قم بلصقه واضغط على <strong>Apply</strong>.</li>
                       <li>قم برفع الإسكرين شوت الخاصة بالفوز (الاسم ورقم الهاتف والكوبون) في حالة الحصول علي المادة او الكورس مجانا بالكامل . او ارفع يصاب الدفع اذل كان خصم فقط.</li>
                       <li className="final-congrats">ثم مبرووك! 🎉</li>
                     </ol>
                  </div>
                </>
              )}

              {/* 4. حالة الجائزة المادية */}
              {winResult.type === 'material' && (
                <div className="instructions-box material-box">
                  <p>🎁 <strong>يرجى أخذ إسكرين شوت لهذه الصفحة التي تحتوي على بياناتك والجائزة، والتواصل مع المدرس لاستلام جائزتك!</strong></p>
                </div>
              )}

              {/* 5. حالة جائزة الترضية (حظ أوفر) */}
              {winResult.type === 'nothing' && (
                <div className="instructions-box material-box" style={{ borderColor: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                  <p style={{ color: '#fca5a5', fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>
                    😢 حظ أوفر المرة القادمة! <br/>
                    نتمنى لك التوفيق في السحوبات والمسابقات القادمة.
                  </p>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ══ LEFT – wheel ══ */}
        <div className="left-panel">
          {loading ? (
            <div className="loading-wheel">
              <div className="loader-ring" />
              <p>جاري تحميل الجوائز...</p>
            </div>
          ) : wheelData.length > 0 ? (
            <SpinWheel
              segments={wheelData}
              mustSpin={mustSpin}
              prizeIndex={prizeNumber}
              onSpinStop={handleSpinStop}
              disabled={isGloballyDisabled}
            />
          ) : null}
        </div>

      </div>

      {/* ══ footer ══ */}
      <div className="bottom-features">
        <div className="feature"><div className="f-icon">🎁</div><div className="f-text"><strong>جوائز قيمة</strong><span>بانتظارك</span></div></div>
        <div className="feature"><div className="f-icon">⭐</div><div className="f-text"><strong>سهل وسريع</strong><span>جرب حظك الآن</span></div></div>
        <div className="feature"><div className="f-icon">🛡️</div><div className="f-text"><strong>موثوق وآمن</strong><span>خصوصيتك تهمنا</span></div></div>
      </div>

      <style jsx>{`
        .wheel-page {
          position:relative; min-height:100vh; width:100vw;
          background-color:#0d0d0d;
          display:flex; flex-direction:column; justify-content:center; align-items:center;
          padding:40px 20px 100px 20px;
          font-family:'Tajawal',sans-serif; direction:rtl; color:white; overflow-x:hidden;
        }
        .bg-fixed-layer { position:fixed; inset:0; background-size:cover; background-position:center; z-index:0; }

        .brand-logo { position:absolute; top:30px; left:40px; z-index:20; }
        .brand-logo img { width:180px; height:auto; filter:drop-shadow(0 0 10px rgba(220,167,66,.4)); }

        .split-layout {
          position:relative; z-index:10;
          display:flex; flex-direction:row; align-items:center; justify-content:space-between;
          width:100%; max-width:1150px; gap:40px; margin-top:20px;
        }
        .right-panel { flex:1; max-width:500px; text-align:right; }
        .left-panel  { flex:1; display:flex; justify-content:center; align-items:center; }

        .main-title { color:#dca742; margin:0 0 10px 0; font-size:3.5rem; font-weight:900; text-shadow:0 5px 15px rgba(0,0,0,.8); line-height:1.2; }
        .subtitle   { color:#cccccc; margin-bottom:30px; font-size:1.2rem; }

        .elegant-form-card { background:#111; border:1px solid #dca742; border-radius:20px; padding:35px 30px; box-shadow:0 20px 40px rgba(0,0,0,.8); }
        .form-title   { color:#dca742; text-align:center; font-size:1.8rem; margin:0 0 10px 0; }
        .form-divider { text-align:center; color:#dca742; margin-bottom:25px; font-size:.8rem; letter-spacing:5px; }
        .form-divider::before,.form-divider::after { content:'♦'; }
        .form-divider .diamond { display:inline-block; width:8px; height:8px; background:#dca742; transform:rotate(45deg); margin:0 15px; }

        .spin-form { display:flex; flex-direction:column; gap:20px; }
        .input-wrapper { position:relative; }
        .input-wrapper input {
          width:100%; padding:16px 45px 16px 16px; border-radius:12px;
          border:1px solid #333; background:#1a1a1a; color:white;
          font-size:1.1rem; outline:none; transition:all .3s ease;
          box-sizing:border-box; font-family:'Tajawal',sans-serif;
        }
        .input-wrapper input:focus   { border-color:#dca742; box-shadow:0 0 15px rgba(220,167,66,.2); }
        .input-wrapper input:disabled { opacity:.6; cursor:not-allowed; }
        .input-icon { position:absolute; right:15px; top:50%; transform:translateY(-50%); color:#dca742; font-size:1.2rem; }

        .spin-btn {
          background:linear-gradient(180deg,#fceebb 0%,#dca742 100%);
          color:#000; border:none; padding:18px; border-radius:12px;
          font-size:1.5rem; font-weight:900; cursor:pointer;
          transition:all .3s ease; margin-top:10px;
          box-shadow:0 10px 20px rgba(220,167,66,.3);
          font-family:'Tajawal',sans-serif;
        }
        .spin-btn:hover:not(:disabled) { transform:translateY(-3px); filter:brightness(1.1); box-shadow:0 15px 30px rgba(220,167,66,.5); }
        .spin-btn:disabled { opacity:.7; cursor:not-allowed; filter:grayscale(.5); }
        .spin-btn.spinning { animation:pulseBtn 1s infinite alternate; }

        .secure-badge { margin-top:25px; text-align:center; color:#888; font-size:.85rem; display:flex; align-items:center; justify-content:center; }

        .error-alert { background:rgba(239,68,68,.2); color:#fca5a5; padding:15px; border-radius:12px; border:1px solid rgba(239,68,68,.4); margin-bottom:20px; font-weight:bold; }
        .already-played-card { background:#111; padding:35px; border-radius:15px; border:1px dashed #dca742; color:#dca742; text-align:center; }

        /* 🏆 كارت الفوز الشامل وتنسيقاته 🏆 */
        .result-card {
          background:linear-gradient(145deg,#111,#1a1500);
          padding:35px 30px; border-radius:20px; border:2px solid #dca742;
          margin-top:20px; text-align:center;
          box-shadow:0 0 40px rgba(220,167,66,.15); animation:fadeInUp .5s ease;
        }
        .confetti-emoji { font-size:3rem; margin-bottom:5px; animation:bounce .6s ease infinite alternate; }
        .congrats-title { color:#dca742; font-size:2.2rem; font-weight:900; margin:0 0 8px 0; }
        
        .student-details-box { background:rgba(0,0,0,0.5); border:1px solid #333; padding:15px 20px; border-radius:12px; margin:20px 0; text-align:right; }
        .student-details-box p { margin:8px 0; font-size:1.1rem; color:#eee; }
        .student-details-box strong { color:#dca742; margin-left:8px; }
        .prize-name { font-weight:900; color:#dca742; }

        .screenshot-alert { background:rgba(220,167,66,0.15); border:1px dashed #dca742; color:#dca742; padding:12px; border-radius:10px; font-size:1.05rem; margin-bottom:20px; font-weight:bold; line-height:1.6; }

        .coupon-box { background:rgba(220,167,66,.07); border:1px solid rgba(220,167,66,.3); border-radius:16px; padding:25px 20px; margin-bottom: 20px;}
        .coupon-label { color:#aaa; font-size:.95rem; margin:0 0 15px 0; }
        .copy-wrapper { display:flex; align-items:center; gap:10px; background:#0d0d0d; border:2px solid #dca742; border-radius:12px; padding:6px 6px 6px 12px; margin-bottom:15px; direction:ltr; }
        .code-display { flex:1; font-family:'Courier New',monospace; font-size:1.6rem; font-weight:900; color:#dca742; letter-spacing:3px; text-align:center; text-shadow:0 0 12px rgba(220,167,66,.5); word-break:break-all; user-select:all; cursor:text; }
        .copy-btn { display:flex; align-items:center; gap:6px; background:linear-gradient(180deg,#fceebb 0%,#dca742 100%); color:#000; border:none; border-radius:9px; padding:10px 16px; font-size:.95rem; font-weight:900; cursor:pointer; white-space:nowrap; transition:all .2s ease; font-family:'Tajawal',sans-serif; flex-shrink:0; }
        .copy-btn:hover  { filter:brightness(1.15); transform:scale(1.03); }
        .copy-btn.copied { background:linear-gradient(180deg,#6ee7a0 0%,#22c55e 100%); }
        
        /* لون مدة الصلاحية الأحمر الجديد */
        .red-validity { color:#ef4444; font-size:1.2rem; font-weight:bold; margin-top:15px; text-shadow:0 0 10px rgba(239,68,68,0.4); }

        .instructions-box { background:rgba(0,0,0,0.4); border-radius:12px; padding:20px; text-align:right; border:1px solid #333; }
        .instructions-box h4 { color:#dca742; margin:0 0 15px 0; font-size:1.2rem; border-bottom:1px dashed #444; padding-bottom:10px;}
        .instructions-box ol { margin:0; padding-right:20px; color:#ccc; line-height:1.8; font-size:1rem; }
        .instructions-box li { margin-bottom:12px; }
        .app-download-links { display:flex; gap:10px; margin-top:10px; }
        .app-download-links a { display:inline-block; background:#222; color:#dca742; padding:6px 15px; border-radius:8px; text-decoration:none; border:1px solid #dca742; transition:all .2s; font-weight:bold; }
        .app-download-links a:hover { background:#dca742; color:#000; }
        .final-congrats { color:#dca742; font-weight:bold; font-size:1.2rem; list-style:none; margin-top:20px; }

        .material-box { text-align: center; }

        .loading-wheel { display:flex; flex-direction:column; align-items:center; gap:20px; color:#dca742; }
        .loader-ring   { width:80px; height:80px; border:6px solid rgba(220,167,66,.2); border-top-color:#dca742; border-radius:50%; animation:spin 1s linear infinite; }

        .bottom-features { position:absolute; bottom:30px; display:flex; justify-content:center; gap:50px; width:100%; z-index:10; }
        .feature { display:flex; align-items:center; gap:15px; }
        .f-icon  { font-size:2rem; color:#dca742; }
        .f-text  { display:flex; flex-direction:column; text-align:right; }
        .f-text strong { color:#fff; font-size:1.1rem; }
        .f-text span   { color:#888; font-size:.9rem; }

        @media (max-width:900px) {
          .brand-logo { position:relative; top:0; left:0; margin-bottom:20px; text-align:center; width:100%; }
          .brand-logo img { width:140px; }
          .split-layout { flex-direction:column-reverse; text-align:center; gap:40px; margin-top:0; }
          .right-panel  { text-align:center; max-width:100%; }
          .main-title   { font-size:2.5rem; }
          .bottom-features { position:relative; bottom:0; flex-direction:column; gap:20px; margin-top:50px; }
          .copy-wrapper { flex-direction:column; direction:rtl; padding:15px; }
          .code-display { font-size:1.3rem; }
          .copy-btn     { width:100%; justify-content:center; }
          .student-details-box { text-align:center; }
          .instructions-box { text-align:center; }
          .instructions-box ol { padding-right:0; list-style-position:inside; }
          .app-download-links { justify-content:center; }
        }

        @keyframes pulseBtn { from{transform:scale(1);}      to{transform:scale(1.02);} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        @keyframes bounce   { from{transform:translateY(0);} to{transform:translateY(-8px);} }
        @keyframes spin     { to{transform:rotate(360deg);} }
      `}</style>
    </div>
  );
}
