import { useMemo, useState } from 'react';
import SuperLayout from '../../../components/SuperLayout';
import {
  PRICING_CONFIG,
  DEFAULT_INPUTS,
  SCENARIOS,
  calculatePricing,
} from '../../../lib/pricingCalculator';

// ─── Formatting helpers (UI only) ───────────────────────────────────────
const nf = (n, d = 2) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const egp = (n, d = 2) => `${nf(n, d)} ج.م`;

const CalcIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="11" x2="8.01" y2="11"></line><line x1="12" y1="11" x2="12.01" y2="11"></line><line x1="16" y1="11" x2="16.01" y2="11"></line><line x1="8" y1="15" x2="8.01" y2="15"></line><line x1="12" y1="15" x2="12.01" y2="15"></line><line x1="16" y1="15" x2="16.01" y2="15"></line><line x1="8" y1="19" x2="16" y2="19"></line></svg>);

// ─── Small presentational pieces ────────────────────────────────────────
function Field({ label, hint, error, children }) {
  return (
    <label className="pc-field">
      <span className="pc-label">{label}</span>
      {children}
      {hint && !error && <span className="pc-hint">{hint}</span>}
      {error && <span className="pc-error">{error}</span>}
    </label>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`pc-row ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function PricingCalculator() {
  const [inputs, setInputsRaw] = useState({ ...DEFAULT_INPUTS });
  const [touched, setTouched] = useState(false); // hide validation noise until the admin starts typing
  const [activeScenario, setActiveScenario] = useState(null);
  const setInputs = (updater) => { setTouched(true); setActiveScenario(null); setInputsRaw(updater); };
  const set = (key) => (e) => setInputs((p) => ({ ...p, [key]: e.target.value }));
  const reset = () => { setTouched(false); setActiveScenario(null); setInputsRaw({ ...DEFAULT_INPUTS }); };
  const loadScenario = (key) => {
    const sc = SCENARIOS[key];
    setTouched(true);
    setActiveScenario(key);
    setInputsRaw((p) => ({ ...p, students: sc.students, courses: sc.courses, hoursPerCourse: sc.hoursPerCourse }));
  };

  // Automatic recalculation on every input change.
  const calc = useMemo(() => calculatePricing(inputs), [inputs]);
  const r = calc.results;
  const errors = touched ? calc.errors : {};
  const hasErrors = !calc.ok;
  const P = PRICING_CONFIG.PRICE;
  const months = r ? r.inputs.storageMonths : 1;
  const monthsLabel = months === 1 ? 'شهر واحد' : `${months} شهر`;

  const numInput = (key, placeholder, mode = 'decimal') => (
    <input className={`pc-input ${errors[key] ? 'bad' : ''}`} inputMode={mode} value={inputs[key]} onChange={set(key)} placeholder={placeholder} />
  );

  return (
    <SuperLayout title="حاسبة التسعير">
      <div className="pc-container">
        {/* ── Header ── */}
        <div className="pc-header">
          <div className="pc-header-icon"><CalcIcon /></div>
          <div>
            <h1>حاسبة تسعير منصة مدد</h1>
            <p>أدخل عدد الطلاب والكورسات ومتوسط ساعات الفيديو لمعرفة السعر المقترح للطالب وتكلفة السيرفرات (التخزين شهرياً + نقل بيانات المشاهدة) والمتبقي بعدها.</p>
          </div>
        </div>

        {/* ── Inputs ── */}
        <section className="pc-panel">
          <div className="pc-panel-head">
            <h3>بيانات المدرس</h3>
            <button type="button" className="pc-btn-reset" onClick={reset}>↺ إعادة التعيين</button>
          </div>

          <div className="pc-scenarios">
            <span className="pc-hint">اختبار سريع:</span>
            {Object.entries(SCENARIOS).map(([key, sc]) => (
              <button key={key} type="button" className={`pc-btn-scn ${activeScenario === key ? 'on' : ''}`} onClick={() => loadScenario(key)}>
                {sc.label}
              </button>
            ))}
          </div>

          <div className="pc-grid">
            <Field label="عدد الطلاب (S)" error={errors.students}>{numInput('students', 'مثال: 170', 'numeric')}</Field>
            <Field label="عدد الكورسات (C)" error={errors.courses}>{numInput('courses', 'مثال: 13', 'numeric')}</Field>
            <Field label="متوسط ساعات الفيديو لكل كورس (h)" error={errors.hoursPerCourse}>{numInput('hoursPerCourse', 'مثال: 15')}</Field>
            <Field label="نسبة المشاهدة % (اختياري)" hint="100% = كل طالب يشاهد كل الساعات مرة واحدة. لا تؤثر على التخزين." error={errors.viewingPercent}>
              {numInput('viewingPercent', '100')}
            </Field>
          </div>

          {/* ── Expandable settings ── */}
          <details className="pc-settings">
            <summary>⚙️ الإعدادات والافتراضات (الأسعار والمعاملات)</summary>

            <h4>أسعار السيرفر (قابلة للتعديل)</h4>
            <div className="pc-grid">
              <Field label="سعر التخزين ($ لكل GB شهرياً)" error={errors.storageUsdPerGbMonth}>{numInput('storageUsdPerGbMonth', '0.01')}</Field>
              <Field label="سعر نقل البيانات ($ لكل GB)" error={errors.bandwidthUsdPerGb}>{numInput('bandwidthUsdPerGb', '0.005')}</Field>
              <Field label="سعر الدولار (ج.م)" error={errors.usdToEgp}>{numInput('usdToEgp', '58')}</Field>
              <Field label="GB تخزين لكل ساعة فيديو" error={errors.storageGbPerHour}>{numInput('storageGbPerHour', '2')}</Field>
              <Field label="GB مشاهدة لكل ساعة لكل طالب" error={errors.viewingGbPerHour}>{numInput('viewingGbPerHour', '1')}</Field>
              <Field label="عدد أشهر التخزين المعروضة" hint="1 = فاتورة تخزين شهر واحد (الافتراضي)." error={errors.storageMonths}>{numInput('storageMonths', '1', 'numeric')}</Field>
            </div>

            <h4>معاملات التسعير (تُعدَّل من الكود: <code>PRICING_CONFIG</code>)</h4>
            <div className="pc-assump">
              <div>السعر الأساسي = {nf(P.BASE_EGP, 2)} + {P.PER_HOUR_EGP} × H + {P.PER_COURSE_EGP} × C</div>
              <div>H = C × h — التقريب لأعلى لأقرب {P.ROUNDING_STEP_EGP} ج.م</div>
            </div>
            <div className="pc-tiers">
              {PRICING_CONFIG.STUDENT_MULTIPLIERS.map((t, i, arr) => {
                const next = arr[i + 1];
                const range = !next ? `${t.minStudents} فأكثر` : i === 0 ? `أقل من ${next.minStudents}` : `${t.minStudents}–${next.minStudents - 1}`;
                return <div key={t.minStudents} className="pc-tier"><span>{range} طالب</span><b>× {t.multiplier.toFixed(2)}</b></div>;
              })}
            </div>
          </details>
        </section>

        {hasErrors && (
          <div className={touched ? 'pc-alert' : 'pc-alert pc-alert-info'}>
            {touched
              ? '⚠️ يرجى تصحيح المدخلات المظللة أعلاه لعرض النتائج.'
              : 'أدخل عدد الطلاب والكورسات ومتوسط الساعات (أو اختر سيناريو اختبار سريع) لعرض النتائج.'}
          </div>
        )}

        {r && (
          <>
            {/* ── Pricing vs server cost — kept visually separate ── */}
            <div className="pc-cards">
              {/* 1 — Pricing calculation */}
              <article className="pc-card pc-card-main">
                <div className="pc-card-title"><span className="pc-num">1</span> حساب السعر</div>
                <div className="pc-big gold">{egp(r.pricePerStudent, 0)}<small>للطالب (الباقة كاملة)</small></div>
                <Row label="إجمالي ساعات الفيديو (H)" value={`${nf(r.hours, 2)} ساعة`} />
                <Row label="السعر الأساسي" value={egp(r.basePrice, 3)} />
                <Row label="معامل عدد الطلاب" value={`× ${r.studentMultiplier.toFixed(2)}`} />
                <Row label="السعر بعد المعامل (قبل التقريب)" value={egp(r.adjustedPrice, 3)} />
                <Row label="السعر النهائي بعد التقريب لأعلى (5 ج.م)" value={egp(r.pricePerStudent, 0)} strong />
                <p className="pc-note">إجمالي الإيراد = عدد الطلاب × السعر النهائي. هذا إيراد مبيعات الباقة، وهو غير متكرر.</p>
              </article>

              {/* 2 — Server costs */}
              <article className="pc-card">
                <div className="pc-card-title"><span className="pc-num">2</span> تكلفة السيرفرات</div>
                <div className="pc-sub">🗄️ التخزين — يُحسب شهرياً (متكرر)</div>
                <Row label="سعة التخزين" value={`${nf(r.storageGB, 2)} GB`} />
                <Row label="تكلفة التخزين الشهرية" value={egp(r.storageCostMonthly)} />
                {months !== 1 && <Row label={`تكلفة التخزين لمدة ${monthsLabel}`} value={egp(r.storageCostTotal)} />}
                <div className="pc-sub">📡 نقل بيانات المشاهدة — حسب المشاهدة المفترضة</div>
                <Row label="إجمالي استهلاك المشاهدة" value={`${nf(r.viewingGB, 2)} GB`} />
                <Row label="تكلفة نقل البيانات" value={egp(r.bandwidthCost)} />
                <Row label={`إجمالي تكلفة السيرفرات (تخزين ${monthsLabel} + نقل بيانات)`} value={egp(r.totalServerCost)} strong />
                <p className="pc-note">⚠️ التخزين يتكرر كل شهر طالما المحتوى مرفوع، أما إيراد الباقة فيُحصَّل مرة واحدة. لذلك تظهر تكلفة التخزين الشهرية منفصلة عن نقل البيانات.</p>
              </article>
            </div>

            {/* ── Revenue summary ── */}
            <section className="pc-summary">
              <div className="pc-sum-item">
                <span>إجمالي إيراد المنصة</span>
                <b>{egp(r.revenue)}</b>
              </div>
              <div className="pc-sum-item">
                <span>إجمالي تكلفة السيرفرات</span>
                <b>{egp(r.totalServerCost)}</b>
              </div>
              <div className="pc-sum-item">
                <span>المتبقي بعد تكلفة السيرفرات</span>
                <b>{egp(r.remaining)}</b>
              </div>
              <div className="pc-sum-item">
                <span>نسبة تكلفة السيرفرات من الإيراد</span>
                <b>{r.serverCostPercent === null ? '—' : `${nf(r.serverCostPercent, 2)}%`}</b>
              </div>
              <div className="pc-sum-item">
                <span>نسبة المتبقي بعد السيرفرات</span>
                <b>{r.remainingPercent === null ? '—' : `${nf(r.remainingPercent, 2)}%`}</b>
              </div>
              <p className="pc-note full">
                المبلغ المتبقي ليس صافي الربح؛ فهو لا يشمل المصروفات التشغيلية الأخرى والضرائب ورسوم الدفع والتسويق والدعم وأي تكاليف أخرى.
                {months === 1 && ' ويحتسب شهراً واحداً فقط من التخزين؛ تكلفة التخزين تتكرر شهرياً.'}
              </p>
            </section>
          </>
        )}
      </div>

      <style jsx global>{`
        .pc-container { max-width: 1100px; margin: 0 auto; padding-bottom: 70px; direction: rtl; }
        .pc-header { display: flex; align-items: center; gap: 16px; margin-bottom: 26px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
        .pc-header-icon { width: 48px; height: 48px; flex-shrink: 0; border-radius: 12px; background: var(--gold-dim); color: var(--gold); border: 1px solid var(--border-accent); display: flex; align-items: center; justify-content: center; }
        .pc-header h1 { margin: 0 0 6px; font-size: 1.6rem; font-weight: 800; color: var(--text-primary); }
        .pc-header p { margin: 0; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; }

        .pc-panel { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px; box-shadow: var(--shadow); margin-bottom: 22px; }
        .pc-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .pc-panel-head h3 { margin: 0; color: var(--gold); font-size: 1.1rem; }
        .pc-btn-reset { background: var(--gold-dimmer); color: var(--gold); border: 1px solid var(--border-accent); border-radius: 9px; padding: 8px 14px; font-weight: 700; cursor: pointer; font-size: 0.88rem; transition: all 0.2s; }
        .pc-btn-reset:hover { background: var(--gold); color: #111009; }

        .pc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
        .pc-field { display: flex; flex-direction: column; gap: 6px; }
        .pc-label { color: var(--text-secondary); font-size: 0.88rem; font-weight: 600; }
        .pc-input { width: 100%; background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border); border-radius: 10px; padding: 11px 12px; font-size: 1rem; font-family: inherit; direction: rtl; outline: none; transition: border-color 0.2s; }
        .pc-input:focus { border-color: var(--gold); }
        .pc-input.bad { border-color: #e5484d; }
        .pc-hint { color: var(--text-muted); font-size: 0.78rem; line-height: 1.5; }
        .pc-error { color: #e5484d; font-size: 0.8rem; font-weight: 600; }

        .pc-sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 22px; margin-top: 24px; padding-top: 20px; border-top: 1px dashed var(--border); }
        .pc-slider { display: flex; flex-direction: column; gap: 8px; }
        .pc-slider-top { display: flex; justify-content: space-between; color: var(--text-secondary); font-weight: 600; font-size: 0.9rem; }
        .pc-slider-top b { color: var(--gold); font-size: 1.05rem; }
        .pc-slider input[type=range] { width: 100%; accent-color: var(--gold); cursor: pointer; }


        .pc-scenarios { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
        .pc-btn-scn { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-accent); border-radius: 9px; padding: 9px 14px; font-weight: 700; cursor: pointer; font-size: 0.88rem; font-family: inherit; transition: all 0.2s; }
        .pc-btn-scn:hover, .pc-btn-scn.on { background: var(--gold); color: #111009; }
        .pc-settings { margin-top: 22px; padding-top: 16px; border-top: 1px dashed var(--border); }
        .pc-settings summary { cursor: pointer; color: var(--gold); font-weight: 800; font-size: 0.95rem; padding: 4px 0; }
        .pc-settings h4 { margin: 18px 0 12px; color: var(--text-primary); font-size: 0.95rem; }
        .pc-settings code { direction: ltr; unicode-bidi: isolate; color: var(--gold); }
        .pc-assump { display: flex; flex-direction: column; gap: 6px; color: var(--text-secondary); font-size: 0.88rem; direction: rtl; margin-bottom: 12px; }
        .pc-tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
        .pc-tier { display: flex; justify-content: space-between; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; color: var(--text-secondary); font-size: 0.85rem; }
        .pc-tier b { color: var(--gold); direction: ltr; }
        .pc-sub { margin: 14px 0 2px; color: var(--gold); font-weight: 800; font-size: 0.88rem; }

        .pc-alert { background: rgba(229,72,77,0.1); border: 1px solid rgba(229,72,77,0.5); color: #e5484d; padding: 12px 16px; border-radius: 12px; font-weight: 600; margin-bottom: 22px; }

        .pc-alert-info { background: var(--gold-dimmer); border-color: var(--border-accent); color: var(--text-secondary); }

        .pc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; margin-bottom: 22px; }
        .pc-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; }
        .pc-card-main { border-color: var(--border-accent); box-shadow: 0 4px 22px var(--gold-dim); }
        .pc-card-title { display: flex; align-items: center; gap: 10px; color: var(--text-primary); font-weight: 800; font-size: 1.02rem; margin-bottom: 10px; }
        .pc-num { width: 26px; height: 26px; border-radius: 50%; background: var(--gold-dim); color: var(--gold); border: 1px solid var(--border-accent); display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; }
        .pc-big { font-size: 2.1rem; font-weight: 900; color: var(--text-primary); margin: 2px 0 10px; display: flex; align-items: baseline; gap: 8px; }
        .pc-big.gold { color: var(--gold); }
        .pc-big small { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; }
        .pc-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 0.9rem; }
        .pc-row b { color: var(--text-primary); font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: plaintext; text-align: left; }
        .pc-row.strong { color: var(--text-primary); font-weight: 700; }
        .pc-row.strong b { color: var(--gold); }
        .pc-note { margin: 10px 0 0; color: var(--text-muted); font-size: 0.8rem; line-height: 1.6; }
        .pc-note.full { grid-column: 1 / -1; margin: 0; }
        .pc-decision { margin: 12px 0 0; padding: 10px 12px; background: var(--gold-dimmer); border: 1px solid var(--border-accent); border-radius: 10px; color: var(--text-primary); font-size: 0.88rem; line-height: 1.7; }

        .pc-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); }
        .pc-sum-item { display: flex; flex-direction: column; gap: 6px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
        .pc-sum-item span { color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; }
        .pc-sum-item b { color: var(--gold); font-size: 1.35rem; font-variant-numeric: tabular-nums; }

        @media (max-width: 600px) {
          .pc-header h1 { font-size: 1.3rem; }
          .pc-big { font-size: 1.8rem; }
          .pc-panel { padding: 16px; }
        }
      `}</style>
    </SuperLayout>
  );
}
