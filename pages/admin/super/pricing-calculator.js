import { useMemo, useState } from 'react';
import SuperLayout from '../../../components/SuperLayout';
import {
  PRICING_CONFIG,
  DEFAULT_INPUTS,
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
  const [inputs, setInputs] = useState({ ...DEFAULT_INPUTS });
  const set = (key) => (e) => setInputs((p) => ({ ...p, [key]: e.target.value }));
  const reset = () => setInputs({ ...DEFAULT_INPUTS });

  // Automatic recalculation on every input change.
  const calc = useMemo(() => calculatePricing(inputs), [inputs]);
  const r = calc.results;
  const errors = calc.errors;
  const hasErrors = !calc.ok;

  const S = PRICING_CONFIG.SAFETY_MARGIN;
  const P = PRICING_CONFIG.PROFIT_MARGIN;

  const decision = r && ({
    market: `السعر السوقي (${egp(r.marketPriceRounded, 0)}) أعلى من الحد الأدنى الآمن (${egp(r.minimumPriceRounded, 0)})، لذلك تم اعتماد السعر السوقي كسعر نهائي.`,
    minimum: `الحد الأدنى الآمن (${egp(r.minimumPriceRounded, 0)}) أعلى من السعر السوقي (${egp(r.marketPriceRounded, 0)})، لذلك تم اعتماد الحد الأدنى الآمن حمايةً للهامش.`,
    equal: `السعر السوقي والحد الأدنى الآمن متساويان (${egp(r.competitivePrice, 0)}).`,
  })[r.determinedBy];

  return (
    <SuperLayout title="حاسبة التسعير">
      <div className="pc-container">
        {/* ── Header ── */}
        <div className="pc-header">
          <div className="pc-header-icon"><CalcIcon /></div>
          <div>
            <h1>حاسبة التسعير الذكية</h1>
            <p>أدخل بيانات المدرس لمعرفة تكلفة السيرفرات الفعلية والحد الأدنى الآمن والسعر التنافسي المقترح للطالب.</p>
          </div>
        </div>

        {/* ── Inputs ── */}
        <section className="pc-panel">
          <div className="pc-panel-head">
            <h3>بيانات المدرس</h3>
            <button type="button" className="pc-btn-reset" onClick={reset}>↺ استعادة المثال الافتراضي</button>
          </div>

          <div className="pc-grid">
            <Field label="عدد الطلاب المشتركين" error={errors.students}>
              <input className={`pc-input ${errors.students ? 'bad' : ''}`} inputMode="numeric" value={inputs.students} onChange={set('students')} placeholder="مثال: 200" />
            </Field>
            <Field label="عدد الكورسات" error={errors.courses}>
              <input className={`pc-input ${errors.courses ? 'bad' : ''}`} inputMode="numeric" value={inputs.courses} onChange={set('courses')} placeholder="مثال: 3" />
            </Field>
            <Field label="متوسط عدد الفيديوهات لكل كورس" error={errors.videosPerCourse}>
              <input className={`pc-input ${errors.videosPerCourse ? 'bad' : ''}`} inputMode="decimal" value={inputs.videosPerCourse} onChange={set('videosPerCourse')} placeholder="مثال: 30" />
            </Field>
            <Field label="متوسط مدة الفيديو (بالدقائق)" error={errors.videoMinutes}>
              <input className={`pc-input ${errors.videoMinutes ? 'bad' : ''}`} inputMode="decimal" value={inputs.videoMinutes} onChange={set('videoMinutes')} placeholder="مثال: 60" />
            </Field>
            <Field label="مدة إتاحة الكورس" error={errors.months}>
              <select className="pc-input" value={inputs.months} onChange={(e) => setInputs((p) => ({ ...p, months: Number(e.target.value) }))}>
                {PRICING_CONFIG.ACCESS_DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} {m <= 10 ? 'أشهر' : 'شهراً'}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="pc-sliders">
            <div className="pc-slider">
              <div className="pc-slider-top"><span>هامش الأمان</span><b>{inputs.safetyMargin}%</b></div>
              <input type="range" min={S.min} max={S.max} step={S.step} value={inputs.safetyMargin}
                onChange={(e) => setInputs((p) => ({ ...p, safetyMargin: Number(e.target.value) }))} />
              <span className="pc-hint">زيادة احتياطية فوق التكلفة لتغطية الاستهلاك أو تغيّر الأسعار ({S.min}% – {S.max}%)</span>
            </div>
            <div className="pc-slider">
              <div className="pc-slider-top"><span>هامش الربح الإجمالي المستهدف</span><b>{inputs.profitMargin}%</b></div>
              <input type="range" min={P.min} max={P.max} step={P.step} value={inputs.profitMargin}
                onChange={(e) => setInputs((p) => ({ ...p, profitMargin: Number(e.target.value) }))} />
              <span className="pc-hint">نسبة الربح من سعر البيع (وليست نسبة إضافة على التكلفة) ({P.min}% – {P.max}%)</span>
            </div>
          </div>
        </section>

        {hasErrors && (
          <div className="pc-alert">
            ⚠️ يرجى تصحيح المدخلات المظللة أعلاه لعرض النتائج.
          </div>
        )}

        {r && (
          <>
            {/* ── Three result cards, in the required order ── */}
            <div className="pc-cards">
              {/* 1 — Actual server costs */}
              <article className="pc-card">
                <div className="pc-card-title"><span className="pc-num">1</span> تكلفة السيرفرات الفعلية</div>
                <Row label="إجمالي ساعات الفيديو" value={`${nf(r.hours, 2)} ساعة`} />
                <Row label="سعة التخزين المطلوبة" value={`${nf(r.storageGB, 2)} GB`} />
                <Row label="تكلفة التخزين (طوال المدة)" value={egp(r.storageCost)} />
                <Row label="تكلفة نقل بيانات المشاهدة" value={egp(r.viewingCost)} />
                <Row label="إجمالي تكلفة السيرفرات" value={egp(r.totalServerCost)} strong />
                <Row label="تكلفة السيرفر لكل طالب" value={egp(r.serverCostPerStudent, 3)} strong />
                <p className="pc-note">تشمل تكاليف السيرفرات فقط، ولا تشمل أي مصروفات تشغيل أخرى.</p>
              </article>

              {/* 2 — Minimum safe price */}
              <article className="pc-card">
                <div className="pc-card-title"><span className="pc-num">2</span> الحد الأدنى الآمن للسعر</div>
                <div className="pc-big">{egp(r.minimumPriceRounded, 0)}<small>للطالب</small></div>
                <Row label="هامش الأمان المختار" value={`${r.inputs.safetyMargin}%`} />
                <Row label="هامش الربح المستهدف" value={`${r.inputs.profitMargin}%`} />
                <Row label="التكلفة المعدّلة لكل طالب" value={egp(r.adjustedCostPerStudent, 3)} />
                <Row label="قبل التقريب" value={egp(r.minimumSafePrice, 3)} />
                <p className="pc-note">
                  التكلفة لكل طالب × (1 + هامش الأمان) ÷ (1 − هامش الربح)، ثم التقريب لأعلى لأقرب 5 جنيه.
                </p>
              </article>

              {/* 3 — Recommended competitive price */}
              <article className="pc-card pc-card-main">
                <div className="pc-card-title"><span className="pc-num">3</span> السعر التنافسي المقترح</div>
                <div className="pc-big gold">{egp(r.competitivePrice, 0)}<small>للطالب</small></div>
                <Row label="السعر السوقي (قبل التقريب)" value={egp(r.marketPrice, 3)} />
                <Row label="السعر السوقي (بعد التقريب)" value={egp(r.marketPriceRounded, 0)} />
                <Row label="الحد الأدنى الآمن" value={egp(r.minimumPriceRounded, 0)} />
                <p className="pc-decision">{decision}</p>
              </article>
            </div>

            {/* ── Revenue summary ── */}
            <section className="pc-summary">
              <div className="pc-sum-item">
                <span>إجمالي الإيراد المتوقع</span>
                <b>{egp(r.totalRevenue)}</b>
              </div>
              <div className="pc-sum-item">
                <span>المتبقي بعد تكلفة السيرفرات</span>
                <b>{egp(r.amountAfterServerCosts)}</b>
              </div>
              <div className="pc-sum-item">
                <span>هامش الربح الإجمالي بعد تكلفة السيرفرات فقط</span>
                <b>{r.grossMarginPercent === null ? '—' : `${nf(r.grossMarginPercent, 2)}%`}</b>
                {r.marginError && <em className="pc-error">{r.marginError}</em>}
              </div>
              <p className="pc-note full">
                هذا ليس صافي الربح؛ فهو لا يشمل أي مصروفات تشغيلية أخرى غير مُدخلة.
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

        .pc-alert { background: rgba(229,72,77,0.1); border: 1px solid rgba(229,72,77,0.5); color: #e5484d; padding: 12px 16px; border-radius: 12px; font-weight: 600; margin-bottom: 22px; }

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
