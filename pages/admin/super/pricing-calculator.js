import { useMemo, useState } from 'react';
import SuperLayout from '../../../components/SuperLayout';
import {
  PRICING_CONFIG,
  DEFAULT_INPUTS,
  SCENARIOS,
  STRATEGY_LABELS,
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
      {error && <span className="pc-error" role="alert">{error}</span>}
    </label>
  );
}

function Row({ label, value, strong, sub }) {
  return (
    <div className={`pc-row ${strong ? 'strong' : ''} ${sub ? 'sub' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

// Slider + number box bound to the same string state (typed values are never altered).
function PercentField({ label, hint, error, value, onChange, min, max, step }) {
  const n = Number(value);
  return (
    <div className="pc-field">
      <span className="pc-label">{label}</span>
      <div className="pc-pct">
        <input type="range" aria-label={label} min={min} max={max} step={step} value={Number.isFinite(n) && value !== '' ? Math.min(Math.max(n, min), max) : min} onChange={(e) => onChange(e.target.value)} />
        <input className={`pc-input pc-pct-box ${error ? 'bad' : ''}`} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} (رقم)`} />
        <span className="pc-pct-sign">%</span>
      </div>
      {hint && !error && <span className="pc-hint">{hint}</span>}
      {error && <span className="pc-error" role="alert">{error}</span>}
    </div>
  );
}

function PriceCard({ title, value, lines, active, badge }) {
  return (
    <div className={`pc-price ${active ? 'on' : ''}`}>
      <div className="pc-price-top"><span>{title}</span>{badge && <em>{badge}</em>}</div>
      <div className="pc-price-val">{nf(value, 0)}<small>ج.م / طالب</small></div>
      {lines.map((l) => <div key={l} className="pc-price-line">{l}</div>)}
    </div>
  );
}

export default function PricingCalculator() {
  const [inputs, setInputsRaw] = useState({ ...DEFAULT_INPUTS });
  const [touched, setTouched] = useState(false); // hide validation noise until the admin starts typing
  const [activeScenario, setActiveScenario] = useState(null);
  const setInputs = (updater) => { setTouched(true); setActiveScenario(null); setInputsRaw(updater); };
  const set = (key) => (e) => setInputs((p) => ({ ...p, [key]: e.target.value }));
  const setVal = (key) => (val) => setInputs((p) => ({ ...p, [key]: val }));
  const reset = () => { setTouched(false); setActiveScenario(null); setInputsRaw({ ...DEFAULT_INPUTS }); };
  const loadScenario = (key) => {
    const sc = SCENARIOS[key];
    setTouched(true);
    setActiveScenario(key);
    setInputsRaw((p) => ({ ...p, students: sc.students, courses: sc.courses, hoursPerCourse: sc.hoursPerCourse, viewingPercent: sc.viewingPercent }));
  };

  // Automatic recalculation on every input change.
  const calc = useMemo(() => calculatePricing(inputs), [inputs]);
  const r = calc.results;
  const errors = touched ? calc.errors : {};
  const hasErrors = !calc.ok;
  const errorList = touched ? Object.values(calc.errors) : [];
  const P = PRICING_CONFIG.PRICE;

  const numInput = (key, placeholder, mode = 'decimal') => (
    <input className={`pc-input ${errors[key] ? 'bad' : ''}`} inputMode={mode} value={inputs[key]} onChange={set(key)} placeholder={placeholder} aria-invalid={!!errors[key]} />
  );

  const opIncluded = r && r.monthlyOperatingCost > 0;
  const sel = r && r.selectedPrice;

  return (
    <SuperLayout title="حاسبة التسعير">
      <div className="pc-container">
        {/* ── Header ── */}
        <div className="pc-header">
          <div className="pc-header-icon"><CalcIcon /></div>
          <div>
            <h1>حاسبة تسعير منصة مدد</h1>
            <p>أدخل عدد الطلاب والكورسات والساعات لمقارنة السعر الأصلي بالحد الأدنى الآمن وسعر الربح المستهدف، مع تكلفة السيرفرات الشهرية.</p>
          </div>
        </div>

        {/* ── Main inputs (always visible) ── */}
        <section className="pc-panel">
          <div className="pc-panel-head">
            <h3>بيانات المدرس</h3>
            <button type="button" className="pc-btn-reset" onClick={reset}>↺ إعادة التعيين</button>
          </div>

          <div className="pc-scenarios">
            {Object.entries(SCENARIOS).map(([key, sc]) => (
              <button key={key} type="button" className={`pc-btn-scn ${activeScenario === key ? 'on' : ''}`} onClick={() => loadScenario(key)}>
                {sc.label}
              </button>
            ))}
          </div>

          <div className="pc-grid">
            <Field label="عدد الطلاب (S)" hint="عدد صحيح أكبر من صفر" error={errors.students}>{numInput('students', 'مثال: 170', 'numeric')}</Field>
            <Field label="عدد الكورسات (C)" hint="عدد صحيح أكبر من صفر" error={errors.courses}>{numInput('courses', 'مثال: 13', 'numeric')}</Field>
            <Field label="متوسط ساعات الفيديو لكل كورس (h)" hint="يمكن إدخال كسور، مثل 7.5" error={errors.hoursPerCourse}>{numInput('hoursPerCourse', 'مثال: 15')}</Field>
            <Field label="نسبة المشاهدة الشهرية المتوقعة (V) %" hint="100% = كل طالب يشاهد كل الساعات مرة في الشهر. لا تؤثر على التخزين." error={errors.viewingPercent}>
              {numInput('viewingPercent', '100')}
            </Field>
          </div>

          {/* ── Collapsible settings ── */}
          <details className="pc-settings">
            <summary>⚙️ Pricing &amp; Cost Settings — إعدادات التسعير والتكلفة</summary>

            <h4>إعدادات العمل (ليست رسوم مزوّد الخدمة)</h4>
            <div className="pc-grid">
              <PercentField label="هامش أمان تكلفة السيرفر" hint="زيادة احتياطية فوق تكلفة السيرفر الشهرية." min={0} max={100} step={5} value={inputs.safetyMargin} onChange={setVal('safetyMargin')} error={errors.safetyMargin} />
              <PercentField label="هامش الربح المستهدف (من الإيراد)" hint="نسبة من سعر البيع وليست زيادة على التكلفة. يجب أن تكون أقل من 100%." min={0} max={95} step={5} value={inputs.profitMargin} onChange={setVal('profitMargin')} error={errors.profitMargin} />
              <Field label="تكلفة تشغيل شهرية إضافية لكل طالب (ج.م)" hint="اختياري، الافتراضي 0" error={errors.opCostPerStudent}>{numInput('opCostPerStudent', '0')}</Field>
              <Field label="مصروفات تشغيل شهرية ثابتة (ج.م)" hint="اختياري، الافتراضي 0" error={errors.fixedOpCost}>{numInput('fixedOpCost', '0')}</Field>
              <Field label="استراتيجية السعر المعتمد" error={errors.strategy}>
                <select className="pc-input" value={inputs.strategy} onChange={set('strategy')}>
                  {PRICING_CONFIG.STRATEGIES.map((k) => <option key={k} value={k}>{STRATEGY_LABELS[k]}</option>)}
                </select>
              </Field>
            </div>

            <h4>أسعار مزوّد السيرفر (قابلة للتعديل)</h4>
            <div className="pc-grid">
              <Field label="سعر التخزين ($ لكل GB شهرياً)" error={errors.storageUsdPerGbMonth}>{numInput('storageUsdPerGbMonth', '0.01')}</Field>
              <Field label="سعر نقل البيانات ($ لكل GB)" error={errors.bandwidthUsdPerGb}>{numInput('bandwidthUsdPerGb', '0.005')}</Field>
              <Field label="سعر الدولار (ج.م)" error={errors.usdToEgp}>{numInput('usdToEgp', '58')}</Field>
              <Field label="GB تخزين لكل ساعة فيديو" error={errors.storageGbPerHour}>{numInput('storageGbPerHour', '2')}</Field>
              <Field label="GB مشاهدة لكل ساعة لكل طالب" error={errors.viewingGbPerHour}>{numInput('viewingGbPerHour', '1')}</Field>
            </div>

            <h4>معاملات المعادلة الأصلية (تُعدَّل من الكود: <code>PRICING_CONFIG</code>)</h4>
            <div className="pc-assump">
              <div>السعر الأساسي = {nf(P.BASE_EGP, 2)} + {P.PER_HOUR_EGP} × H + {P.PER_COURSE_EGP} × C &nbsp;—&nbsp; H = C × h</div>
              <div>التقريب لأعلى لأقرب {P.ROUNDING_STEP_EGP} ج.م لكل الأسعار</div>
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
          <div className={touched ? 'pc-alert' : 'pc-alert pc-alert-info'} role="status">
            {touched ? (
              <>
                ⚠️ يرجى تصحيح المدخلات التالية لعرض النتائج:
                <ul>{errorList.map((m) => <li key={m}>{m}</li>)}</ul>
              </>
            ) : 'أدخل عدد الطلاب والكورسات ومتوسط الساعات (أو اختر سيناريو اختبار سريع) لعرض النتائج.'}
          </div>
        )}

        {r && (
          <>
            {/* ═════════ Group A — Pricing ═════════ */}
            <h2 className="pc-group">أ) التسعير</h2>

            <section className="pc-hero">
              <div>
                <span className="pc-hero-label">السعر المعتمد للطالب — {STRATEGY_LABELS[r.inputs.strategy]}</span>
                <div className="pc-hero-val">{nf(sel, 0)}<small>ج.م / طالب</small></div>
              </div>
              <div className="pc-hero-side">
                <div>إيراد الباقة بالسعر المعتمد</div>
                <b>{egp(r.atSelected.revenue)}</b>
                {r.inputs.strategy !== 'highest' && <div className="pc-hint">السعر الأعلى المقترح: {egp(r.recommendedFinalPrice, 0)}</div>}
              </div>
            </section>

            <div className="pc-prices">
              <PriceCard
                title="السعر 1 — السعر الأصلي (المعادلة)"
                value={r.originalPrice}
                active={r.inputs.strategy === 'original'}
                badge={r.highestIs.includes('original') ? 'الأعلى' : null}
                lines={[`السعر الأساسي ${egp(r.basePrice, 3)}`, `× معامل الطلاب ${r.studentMultiplier.toFixed(2)}`, `قبل التقريب ${egp(r.adjustedPrice, 3)}`]}
              />
              <PriceCard
                title="السعر 2 — الحد الأدنى الآمن (شامل التشغيل)"
                value={r.minimumSafeInclOp}
                active={r.inputs.strategy === 'minimum'}
                badge={r.highestIs.includes('minimum') ? 'الأعلى' : null}
                lines={[
                  `السيرفر فقط: ${egp(r.minimumSafeServerOnly, 0)} (قبل التقريب ${nf(r.minimumSafeServerOnlyRaw, 3)})`,
                  `شامل التشغيل: قبل التقريب ${nf(r.minimumSafeInclOpRaw, 3)}`,
                  `يشمل: تكلفة السيرفر + هامش أمان ${nf(r.inputs.safetyMargin, 0)}%${opIncluded ? ' + مصروفات التشغيل المُدخلة' : ' (لا مصروفات تشغيل مُدخلة)'}`,
                ]}
              />
              <PriceCard
                title="السعر 3 — سعر الربح المستهدف"
                value={r.targetProfitPrice}
                active={r.inputs.strategy === 'target'}
                badge={r.highestIs.includes('target') ? 'الأعلى' : null}
                lines={[`هامش ${nf(r.inputs.profitMargin, 0)}% من الإيراد`, `قبل التقريب ${egp(r.targetProfitRaw, 3)}`, 'يشمل: تكلفة السيرفر + مصروفات التشغيل المُدخلة']}
              />
            </div>

            <section className="pc-card">
              <div className="pc-card-title"><span className="pc-num">أ</span> ملخص التسعير</div>
              <Row label="إجمالي ساعات الفيديو (H)" value={`${nf(r.hours, 2)} ساعة`} />
              <Row label="السعر الأصلي للطالب" value={egp(r.originalPrice, 0)} />
              <Row label="الحد الأدنى الآمن — السيرفر فقط" value={egp(r.minimumSafeServerOnly, 0)} />
              <Row label="الحد الأدنى الآمن — شامل مصروفات التشغيل" value={egp(r.minimumSafeInclOp, 0)} />
              <Row label="سعر الربح المستهدف" value={egp(r.targetProfitPrice, 0)} />
              <Row label="السعر المعتمد للطالب" value={egp(sel, 0)} strong />
              <Row label="إجمالي إيراد الباقة بالسعر المعتمد" value={egp(r.atSelected.revenue)} strong />
              <Row label="الإيراد بالسعر الأصلي" value={egp(r.atOriginal.revenue)} />
              <p className="pc-note">الأسعار الثلاثة محسوبة بشكل مستقل ولا تتغير باختيار الاستراتيجية. مصروفات التشغيل مضافة فقط إلى السعرين 2 و3، وليست جزءاً من المعادلة الأصلية.</p>
            </section>

            {/* ═════════ Group B — Monthly server economics ═════════ */}
            <h2 className="pc-group">ب) اقتصاديات السيرفر الشهرية</h2>

            <div className="pc-cards">
              <article className="pc-card">
                <div className="pc-card-title"><span className="pc-num">ب</span> تكلفة السيرفر الشهرية</div>
                <div className="pc-sub">🗄️ التخزين — فاتورة شهرية متكررة (تُحسب مرة واحدة للمحتوى)</div>
                <Row label="إجمالي ساعات الفيديو المرفوعة" value={`${nf(r.hours, 2)} ساعة`} />
                <Row label="سعة التخزين" value={`${nf(r.storageGB, 2)} GB`} />
                <Row label="تكلفة التخزين الشهرية" value={egp(r.storageCost)} />
                <Row label="حصة الطالب من التخزين (توزيع فقط)" value={egp(r.storageCostPerStudent, 4)} />
                <div className="pc-sub">📡 نقل البيانات — حسب المشاهدة المفترضة خلال الشهر</div>
                <Row label="استهلاك المشاهدة الشهري" value={`${nf(r.viewingGB, 2)} GB`} />
                <Row label="تكلفة نقل البيانات للشهر" value={egp(r.bandwidthCost)} />
                <Row label="تكلفة نقل البيانات لكل طالب" value={egp(r.bandwidthCostPerStudent, 4)} />
                <Row label="إجمالي تكلفة السيرفر الشهرية" value={egp(r.totalServerCost)} strong />
                <Row label="إجمالي التكلفة الشهرية لكل طالب" value={egp(r.serverCostPerStudent, 4)} strong />
                <p className="pc-note">حصة الطالب من التخزين مجرد توزيع لفاتورة تخزين مشتركة؛ المزوّد لا يحاسب كل طالب على حدة. مصروفات التشغيل المُدخلة: {egp(r.monthlyOperatingCost)} شهرياً (غير مضمّنة أعلاه).</p>
              </article>

              <article className="pc-card pc-card-main">
                <div className="pc-card-title"><span className="pc-num">ب</span> المتبقي بعد تكلفة السيرفر الشهرية — قبل أي مصروفات أخرى</div>
                <table className="pc-table">
                  <thead><tr><th></th><th>السعر المعتمد ({nf(sel, 0)})</th><th>السعر الأصلي ({nf(r.originalPrice, 0)})</th></tr></thead>
                  <tbody>
                    <tr><td>الإيراد</td><td>{egp(r.atSelected.revenue)}</td><td>{egp(r.atOriginal.revenue)}</td></tr>
                    <tr><td>الإيراد المتبقي بعد تكاليف السيرفر الشهرية — قبل المصروفات الأخرى</td><td>{egp(r.atSelected.remaining)}</td><td>{egp(r.atOriginal.remaining)}</td></tr>
                    <tr><td>المتبقي لكل طالب بعد تكاليف السيرفر الشهرية — قبل المصروفات الأخرى</td><td>{egp(r.atSelected.remainingPerStudent)}</td><td>{egp(r.atOriginal.remainingPerStudent)}</td></tr>
                    <tr><td>نسبة تكلفة السيرفر من الإيراد</td><td>{r.atSelected.serverCostPercent === null ? '—' : `${nf(r.atSelected.serverCostPercent, 2)}%`}</td><td>{r.atOriginal.serverCostPercent === null ? '—' : `${nf(r.atOriginal.serverCostPercent, 2)}%`}</td></tr>
                    <tr><td>نسبة المتبقي بعد السيرفر</td><td>{r.atSelected.remainingPercent === null ? '—' : `${nf(r.atSelected.remainingPercent, 2)}%`}</td><td>{r.atOriginal.remainingPercent === null ? '—' : `${nf(r.atOriginal.remainingPercent, 2)}%`}</td></tr>
                  </tbody>
                </table>
                <p className="pc-decision">
                  هذه المبالغ ليست صافي ربح. فهي لا تشمل أي تكاليف غير مُدخلة صراحةً، مثل الضرائب ورسوم بوابات الدفع والتسويق والموظفين والدعم والتطوير والمرتجعات.
                  التخزين يمثل فاتورة شهر واحد، ونقل البيانات هو التقدير الناتج عن المشاهدة المفترضة في ذلك الشهر؛ والمقارنة بالإيراد تقدير تخطيطي شهري فقط، وليست ادعاءً بأن كل الإيراد يتحقق كل شهر أو أن دورات فوترة التخزين ونقل البيانات متطابقة عند كل مزوّد.
                </p>
              </article>
            </div>
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


        .pc-pct { display: flex; align-items: center; gap: 10px; direction: ltr; }
        .pc-pct input[type=range] { flex: 1; min-width: 0; accent-color: var(--gold); cursor: pointer; }
        .pc-pct-box { width: 78px !important; text-align: center; padding: 9px 6px; direction: ltr; }
        .pc-pct-sign { color: var(--text-muted); font-weight: 700; }
        .pc-group { margin: 30px 0 14px; font-size: 1.15rem; font-weight: 800; color: var(--gold); padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .pc-hero { display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap; background: var(--bg-surface); border: 1px solid var(--border-accent); border-radius: 16px; padding: 20px; box-shadow: 0 4px 22px var(--gold-dim); margin-bottom: 16px; }
        .pc-hero-label { color: var(--text-secondary); font-weight: 700; font-size: 0.9rem; }
        .pc-hero-val { font-size: 2.8rem; font-weight: 900; color: var(--gold); display: flex; align-items: baseline; gap: 8px; line-height: 1.2; }
        .pc-hero-val small { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; }
        .pc-hero-side { color: var(--text-secondary); font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px; }
        .pc-hero-side b { color: var(--text-primary); font-size: 1.3rem; font-variant-numeric: tabular-nums; direction: ltr; text-align: right; }
        .pc-prices { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 18px; }
        .pc-price { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
        .pc-price.on { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        .pc-price-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--text-secondary); font-weight: 700; font-size: 0.88rem; }
        .pc-price-top em { font-style: normal; background: var(--gold-dim); color: var(--gold); border: 1px solid var(--border-accent); border-radius: 20px; padding: 1px 9px; font-size: 0.72rem; }
        .pc-price-val { font-size: 2rem; font-weight: 900; color: var(--text-primary); display: flex; align-items: baseline; gap: 6px; font-variant-numeric: tabular-nums; }
        .pc-price-val small { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; }
        .pc-price-line { color: var(--text-muted); font-size: 0.8rem; line-height: 1.6; }
        .pc-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; margin-top: 4px; }
        .pc-table th, .pc-table td { padding: 9px 6px; border-bottom: 1px solid var(--border); text-align: right; color: var(--text-secondary); vertical-align: top; }
        .pc-table th { color: var(--gold); font-weight: 800; font-size: 0.8rem; }
        .pc-table td:not(:first-child) { color: var(--text-primary); font-weight: 700; font-variant-numeric: tabular-nums; direction: ltr; text-align: left; white-space: nowrap; }
        .pc-alert ul { margin: 8px 0 0; padding-inline-start: 20px; font-weight: 500; }

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
