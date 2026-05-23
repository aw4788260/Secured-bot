import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import fpPromise from '@fingerprintjs/fingerprintjs';

import medaadLogo from '../styles/medaad-logo.png';
import starsBg    from '../styles/stars-bg.jpg';

/* ═══════════════════════════════════════════════
   Custom Canvas Wheel Component
   – Full text control, 3-D tilt, backend-driven winner
═══════════════════════════════════════════════ */
function SpinWheel({ segments, mustSpin, prizeIndex, onSpinStop, disabled }) {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const stateRef    = useRef({
    angle:       0,       // current rotation in radians
    velocity:    0,       // rad per frame
    spinning:    false,
    targetAngle: 0,
  });

  const COLORS_ODD  = '#dca742';
  const COLORS_EVEN = '#181818';
  const TEXT_ODD    = '#181818';
  const TEXT_EVEN   = '#dca742';
  const GOLD        = '#dca742';
  const DARK        = '#181818';

  /* ── draw one frame ── */
  const draw = useCallback((angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    const cx  = W / 2;
    const cy  = H / 2;
    const R   = W / 2 - 8;          // outer radius (leave room for shadow)
    const n   = segments.length;
    if (!n) return;

    ctx.clearRect(0, 0, W, H);

    /* ── drop shadow under wheel ── */
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur    = 28;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    /* ── segments ── */
    const arc = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const startAngle = angle + i * arc;
      const endAngle   = startAngle + arc;
      const isOdd      = i % 2 === 0;
      const bg         = isOdd ? COLORS_ODD  : COLORS_EVEN;
      const fg         = isOdd ? TEXT_ODD    : TEXT_EVEN;

      /* fill */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = bg;
      ctx.fill();

      /* subtle inner shine */
      const grad = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
      grad.addColorStop(0,   isOdd ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)');
      grad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      /* divider line */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = '#8b5a10';
      ctx.lineWidth   = 2;
      ctx.stroke();

      /* ── text (drawn radially, mid-segment) ── */
      const midAngle  = startAngle + arc / 2;
      const textR     = R * 0.62;           // 62% from centre → well away from hub
      const tx        = cx + Math.cos(midAngle) * textR;
      const ty        = cy + Math.sin(midAngle) * textR;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);   // rotate text to face outward

      /* wrap text if too long */
      const label   = segments[i].option || '';
      const maxW    = arc * R * 0.78;       // approx chord width at textR
      const fsize   = Math.max(11, Math.min(15, 340 / n));
      ctx.font      = `bold ${fsize}px Tajawal, Arial, sans-serif`;
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      /* simple 2-line wrap */
      const words   = label.split(' ');
      let   line1   = '', line2 = '';
      let   built   = '';
      let   wrapped = false;
      for (const w of words) {
        const test = built ? built + ' ' + w : w;
        if (!wrapped && ctx.measureText(test).width > maxW) {
          line1   = built;
          built   = w;
          wrapped = true;
        } else {
          built = test;
        }
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

    /* ── outer gold border ── */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth   = 10;
    ctx.stroke();

    /* ── outer dark border ── */
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#8b5a10';
    ctx.lineWidth   = 5;
    ctx.stroke();

    /* ── hub (centre circle) ── */
    const hubR = R * 0.13;
    const hubGrad = ctx.createRadialGradient(cx - hubR*0.3, cy - hubR*0.3, 1, cx, cy, hubR);
    hubGrad.addColorStop(0, '#fceebb');
    hubGrad.addColorStop(1, GOLD);
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = DARK;
    ctx.lineWidth   = 4;
    ctx.stroke();

    /* hub label */
    ctx.font      = `bold ${Math.max(10, hubR * 0.7)}px Tajawal, Arial`;
    ctx.fillStyle = DARK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(disabled ? '🔒' : 'لف', cx, cy);

  }, [segments, disabled]);

  /* ── pointer / ticker ── */
  const drawPointer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const cx  = W / 2;
    const R   = W / 2 - 8;
    const py  = 8;          // tip y (top-center)
    const pw  = 18;
    const ph  = 36;

    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 3;

    const g = ctx.createLinearGradient(cx, py, cx, py + ph);
    g.addColorStop(0, '#fceebb');
    g.addColorStop(1, GOLD);
    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.moveTo(cx, py);                          // tip
    ctx.lineTo(cx - pw / 2, py + ph);
    ctx.lineTo(cx + pw / 2, py + ph);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#8b5a10';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();
  };

  /* ── animation loop ── */
  const animate = useCallback(() => {
    const s = stateRef.current;
    if (!s.spinning) return;

    s.angle    += s.velocity;
    s.velocity *= 0.985;           // friction

    draw(s.angle);
    drawPointer();

    /* check if we've crossed the target and slowed enough */
    const remaining = Math.abs(s.targetAngle - s.angle) % (Math.PI * 2);
    if (s.velocity < 0.002 && remaining < 0.08) {
      s.spinning = false;
      s.angle    = s.targetAngle;
      draw(s.angle);
      drawPointer();
      onSpinStop();
      return;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [draw, onSpinStop]);

  /* ── trigger spin when mustSpin changes to true ── */
  useEffect(() => {
    if (!mustSpin || !segments.length) return;

    const n         = segments.length;
    const arc       = (Math.PI * 2) / n;
    const s         = stateRef.current;

    /* Calculate landing angle so prizeIndex segment lands under the top pointer.
       Pointer is at top (−π/2). We want the centre of the winning segment there. */
    const winMid    = prizeIndex * arc + arc / 2;
    const spins     = 8;                              // full rotations before landing
    const landing   = -Math.PI / 2 - winMid + Math.PI * 2 * spins;
    // normalise so we always spin forward
    s.targetAngle   = landing + Math.ceil((s.angle - landing) / (Math.PI * 2) + 1) * Math.PI * 2;
    s.velocity      = 0.45 + Math.random() * 0.05;   // initial speed
    s.spinning      = true;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [mustSpin]);

  /* ── initial draw ── */
  useEffect(() => {
    if (segments.length) {
      draw(stateRef.current.angle);
      drawPointer();
    }
  }, [segments, draw]);

  return (
    <div className="canvas-wheel-wrap">
      {/* 3-D tilt via CSS perspective */}
      <div className="wheel-3d-stage">
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          className="wheel-canvas"
        />
      </div>
      <style jsx>{`
        .canvas-wheel-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        /* ✅ True 3-D tilt */
        .wheel-3d-stage {
          perspective: 900px;
          perspective-origin: 50% 30%;
        }
        .wheel-canvas {
          display: block;
          transform: rotateX(18deg);
          border-radius: 50%;
          box-shadow:
            0 30px 60px rgba(0,0,0,0.9),
            0 0 0 6px #8b5a10,
            0 14px 0 10px #633f07;
          transition: filter .3s;
          filter: ${disabled ? 'grayscale(0.4) brightness(0.8)' : 'none'};
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════ */
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

  /* ── init fingerprint + data ── */
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
      if (data.hasPlayed) {
        localStorage.setItem('wheel_has_played', 'true');
        setHasPlayedLocal(true);
      } else {
        localStorage.removeItem('wheel_has_played');
        setHasPlayedLocal(false);
      }
    } catch {
      if (localStorage.getItem('wheel_has_played')) setHasPlayedLocal(true);
    }
  };

  const fetchWheelPrizes = async () => {
    try {
      const res  = await fetch('/api/dashboard/super/wheel');
      const data = await res.json();

      if (data?.isWheelEnabled === false) setIsGloballyDisabled(true);

      if (data?.prizes?.length > 0) {
        const active = data.prizes.filter(p => p.is_active);
        setPrizes(active);

        if (active.length >= 2) {
          setWheelData(active.map((p, i) => ({
            option: p.title,
            style: {
              backgroundColor: i % 2 === 0 ? '#dca742' : '#181818',
              textColor:       i % 2 === 0 ? '#181818' : '#dca742',
            },
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

  /* ── spin click → call backend ── */
  const handleSpinClick = async (e) => {
    e.preventDefault();
    if (mustSpin || spinning || hasPlayedLocal || isGloballyDisabled || loading) return;
    if (!studentName || !studentPhone)
      return setErrorMsg('يرجى إدخال اسمك ورقم هاتفك أولاً.');

    setErrorMsg('');
    setSpinning(true);

    try {
      const res  = await fetch('/api/public/spin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ studentName, studentPhone, fingerprint }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const idx = prizes.findIndex(p => p.id === data.prize.id);
        if (idx !== -1) {
          setWinResult(data.prize);
          setPrizeNumber(idx);
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
    } catch {
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

  /* ── copy coupon ── */
  const handleCopyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement('textarea');
      el.value = code;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  /* ══════════════ render ══════════════ */
  return (
    <div className="wheel-page">
      <Head><title>عجلة حظ مداد 🎡</title></Head>

      <div className="bg-fixed-layer" style={{ backgroundImage: `url(${starsBg.src})` }} />

      <div className="brand-logo">
        <img src={medaadLogo.src} alt="Medaad Logo" />
      </div>

      <div className="split-layout">

        {/* ══════ القسم الأيمن ══════ */}
        <div className="right-panel">
          <h1 className="main-title">جرب حظك واربح!</h1>
          <p className="subtitle">أدخل بياناتك ولف العجلة لتربح جوائز مذهلة</p>

          {errorMsg && <div className="error-alert">⚠️ {errorMsg}</div>}

          {isGloballyDisabled ? (
            <div className="elegant-form-card" style={{ textAlign: 'center', borderColor: '#ef4444' }}>
              <h3 style={{ color: '#ef4444', fontSize: '1.8rem', marginBottom: '15px' }}>🔴 المسابقة متوقفة</h3>
              <p style={{ color: '#cccccc', fontSize: '1.1rem', lineHeight: '1.6' }}>
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
                    value={studentName} onChange={e => setStudentName(e.target.value)}
                    required disabled={spinning || loading} />
                  <span className="input-icon">👤</span>
                </div>
                <div className="input-wrapper">
                  <input type="tel" dir="ltr" placeholder="رقم الهاتف"
                    value={studentPhone} onChange={e => setStudentPhone(e.target.value)}
                    required disabled={spinning || loading} />
                  <span className="input-icon" style={{ left: 'auto', right: '15px' }}>📞</span>
                </div>
                <button type="submit" disabled={spinning || loading}
                  className={`spin-btn ${spinning ? 'spinning' : ''}`}>
                  {spinning ? 'جاري السحب...' : loading ? 'تجهيز العجلة...' : 'لف العجلة 🎡'}
                </button>
              </form>

              <div className="secure-badge">
                <span style={{ marginRight: '5px' }}>🛡️</span>
                بياناتك آمنة لدينا ولن يتم مشاركتها مع أي طرف آخر
              </div>
            </div>

          ) : hasPlayedLocal && !winResult ? (
            <div className="already-played-card">
              <h3>شكراً لمشاركتك!</h3>
              <p>لقد قمت بتجربة حظك مسبقاً. 🎉</p>
            </div>
          ) : null}

          {/* ══ كارت الفوز ══ */}
          {winResult && !mustSpin && (
            <div className="result-card">
              <div className="confetti-emoji">🎉</div>
              <h2 className="congrats-title">مبروووك!</h2>
              <p className="congrats-sub">
                لقد فزت بـ: <span className="prize-name">{winResult.title}</span>
              </p>

              {winResult.type === 'coupon' && (
                <div className="coupon-box">
                  <p className="coupon-label">🎟️ كود الخصم الخاص بك</p>

                  <div className="copy-wrapper">
                    <div className="code-display">{winResult.coupon_code}</div>
                    <button
                      className={`copy-btn ${copied ? 'copied' : ''}`}
                      onClick={() => handleCopyCoupon(winResult.coupon_code)}
                    >
                      {copied ? (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          تم النسخ!
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          انسخ الكود
                        </>
                      )}
                    </button>
                  </div>

                  <small className="validity-note">
                    ⏳ صالح لمدة {winResult.validity_days} يوم — احتفظ به جيداً!
                  </small>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════ القسم الأيسر – العجلة ══════ */}
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

      {/* ══════ فوتر ══════ */}
      <div className="bottom-features">
        <div className="feature">
          <div className="f-icon">🎁</div>
          <div className="f-text"><strong>جوائز قيمة</strong><span>بانتظارك</span></div>
        </div>
        <div className="feature">
          <div className="f-icon">⭐</div>
          <div className="f-text"><strong>سهل وسريع</strong><span>جرب حظك الآن</span></div>
        </div>
        <div className="feature">
          <div className="f-icon">🛡️</div>
          <div className="f-text"><strong>موثوق وآمن</strong><span>خصوصيتك تهمنا</span></div>
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
          position: fixed; inset: 0;
          background-size: cover; background-position: center; z-index: 0;
        }
        .brand-logo { position: absolute; top: 30px; left: 40px; z-index: 20; }
        .brand-logo img {
          width: 180px; height: auto;
          filter: drop-shadow(0 0 10px rgba(220,167,66,.4));
        }
        .split-layout {
          position: relative; z-index: 10;
          display: flex; flex-direction: row;
          align-items: center; justify-content: space-between;
          width: 100%; max-width: 1150px; gap: 40px; margin-top: 20px;
        }
        .right-panel { flex: 1; max-width: 500px; text-align: right; }
        .left-panel  {
          flex: 1; display: flex;
          justify-content: center; align-items: center;
          padding-top: 40px;   /* offset for 3-D tilt visual */
        }
        .main-title {
          color: #dca742; margin: 0 0 10px 0;
          font-size: 3.5rem; font-weight: 900;
          text-shadow: 0 5px 15px rgba(0,0,0,.8); line-height: 1.2;
        }
        .subtitle { color: #cccccc; margin-bottom: 30px; font-size: 1.2rem; }

        /* ── form card ── */
        .elegant-form-card {
          background: #111111; border: 1px solid #dca742;
          border-radius: 20px; padding: 35px 30px;
          box-shadow: 0 20px 40px rgba(0,0,0,.8);
        }
        .form-title { color: #dca742; text-align: center; font-size: 1.8rem; margin: 0 0 10px 0; }
        .form-divider {
          text-align: center; color: #dca742;
          margin-bottom: 25px; font-size: .8rem; letter-spacing: 5px;
        }
        .form-divider::before, .form-divider::after { content: '♦'; }
        .form-divider .diamond {
          display: inline-block; width: 8px; height: 8px;
          background: #dca742; transform: rotate(45deg); margin: 0 15px;
        }
        .spin-form { display: flex; flex-direction: column; gap: 20px; }
        .input-wrapper { position: relative; }
        .input-wrapper input {
          width: 100%; padding: 16px 45px 16px 16px;
          border-radius: 12px; border: 1px solid #333;
          background: #1a1a1a; color: white; font-size: 1.1rem;
          outline: none; transition: all .3s ease;
          box-sizing: border-box; font-family: 'Tajawal', sans-serif;
        }
        .input-wrapper input:focus { border-color: #dca742; box-shadow: 0 0 15px rgba(220,167,66,.2); }
        .input-wrapper input:disabled { opacity: .6; cursor: not-allowed; }
        .input-icon {
          position: absolute; right: 15px; top: 50%;
          transform: translateY(-50%); color: #dca742; font-size: 1.2rem;
        }
        .spin-btn {
          background: linear-gradient(180deg,#fceebb 0%,#dca742 100%);
          color: #000; border: none; padding: 18px; border-radius: 12px;
          font-size: 1.5rem; font-weight: 900; cursor: pointer;
          transition: all .3s ease; margin-top: 10px;
          box-shadow: 0 10px 20px rgba(220,167,66,.3);
          font-family: 'Tajawal', sans-serif;
        }
        .spin-btn:hover:not(:disabled) {
          transform: translateY(-3px); filter: brightness(1.1);
          box-shadow: 0 15px 30px rgba(220,167,66,.5);
        }
        .spin-btn:disabled { opacity: .7; cursor: not-allowed; filter: grayscale(.5); }
        .spin-btn.spinning { animation: pulseBtn 1s infinite alternate; }
        .secure-badge {
          margin-top: 25px; text-align: center; color: #888;
          font-size: .85rem; display: flex; align-items: center; justify-content: center;
        }

        /* ── states ── */
        .error-alert {
          background: rgba(239,68,68,.2); color: #fca5a5;
          padding: 15px; border-radius: 12px;
          border: 1px solid rgba(239,68,68,.4);
          margin-bottom: 20px; font-weight: bold;
        }
        .already-played-card {
          background: #111; padding: 35px; border-radius: 15px;
          border: 1px dashed #dca742; color: #dca742; text-align: center;
        }

        /* ── win card ── */
        .result-card {
          background: linear-gradient(145deg,#111111,#1a1500);
          padding: 35px 30px; border-radius: 20px;
          border: 2px solid #dca742; margin-top: 20px; text-align: center;
          box-shadow: 0 0 40px rgba(220,167,66,.15);
          animation: fadeInUp .5s ease;
        }
        .confetti-emoji { font-size: 3rem; margin-bottom: 5px; animation: bounce .6s ease infinite alternate; }
        .congrats-title { color: #dca742; font-size: 2.2rem; font-weight: 900; margin: 0 0 8px 0; }
        .congrats-sub   { color: #ccc; font-size: 1.1rem; margin: 0 0 20px 0; }
        .prize-name     { color: #dca742; font-weight: 900; }

        /* ── coupon ── */
        .coupon-box {
          background: rgba(220,167,66,.07);
          border: 1px dashed rgba(220,167,66,.5);
          border-radius: 16px; padding: 25px 20px;
        }
        .coupon-label { color: #aaa; font-size: .95rem; margin: 0 0 15px 0; }
        .copy-wrapper {
          display: flex; align-items: center; gap: 10px;
          background: #0d0d0d; border: 2px solid #dca742;
          border-radius: 12px; padding: 6px 6px 6px 12px;
          margin-bottom: 15px; direction: ltr;
        }
        .code-display {
          flex: 1; font-family: 'Courier New', monospace;
          font-size: 1.6rem; font-weight: 900; color: #dca742;
          letter-spacing: 3px; text-align: center;
          text-shadow: 0 0 12px rgba(220,167,66,.5);
          word-break: break-all; user-select: all; cursor: text;
        }
        .copy-btn {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg,#fceebb 0%,#dca742 100%);
          color: #000; border: none; border-radius: 9px;
          padding: 10px 16px; font-size: .95rem; font-weight: 900;
          cursor: pointer; white-space: nowrap; transition: all .2s ease;
          font-family: 'Tajawal', sans-serif; flex-shrink: 0;
        }
        .copy-btn:hover  { filter: brightness(1.15); transform: scale(1.03); }
        .copy-btn.copied { background: linear-gradient(180deg,#6ee7a0 0%,#22c55e 100%); }
        .validity-note   { color: #888; font-size: .85rem; display: block; margin-top: 8px; }

        /* ── loading ── */
        .loading-wheel { display: flex; flex-direction: column; align-items: center; gap: 20px; color: #dca742; }
        .loader-ring {
          width: 80px; height: 80px;
          border: 6px solid rgba(220,167,66,.2);
          border-top-color: #dca742;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* ── footer ── */
        .bottom-features {
          position: absolute; bottom: 30px;
          display: flex; justify-content: center; gap: 50px;
          width: 100%; z-index: 10;
        }
        .feature { display: flex; align-items: center; gap: 15px; }
        .f-icon  { font-size: 2rem; color: #dca742; }
        .f-text  { display: flex; flex-direction: column; text-align: right; }
        .f-text strong { color: #fff; font-size: 1.1rem; }
        .f-text span   { color: #888; font-size: .9rem; }

        /* ── responsive ── */
        @media (max-width: 900px) {
          .brand-logo {
            position: relative; top: 0; left: 0;
            margin-bottom: 20px; text-align: center; width: 100%;
          }
          .brand-logo img { width: 140px; }
          .split-layout { flex-direction: column-reverse; text-align: center; gap: 50px; margin-top: 0; }
          .right-panel  { text-align: center; max-width: 100%; }
          .left-panel   { padding-top: 20px; }
          .main-title   { font-size: 2.5rem; }
          .bottom-features { position: relative; bottom: 0; flex-direction: column; gap: 20px; margin-top: 50px; }
          .copy-wrapper { flex-direction: column; direction: rtl; padding: 15px; }
          .code-display { font-size: 1.3rem; }
          .copy-btn     { width: 100%; justify-content: center; }
        }

        @keyframes pulseBtn { from { transform: scale(1); }      to { transform: scale(1.02); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce   { from { transform: translateY(0); } to { transform: translateY(-8px); } }
        @keyframes spin     { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
