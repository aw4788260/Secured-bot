// lib/pricingCalculator.js
// ─────────────────────────────────────────────────────────────────────────────
// Madad pricing calculator — pure calculation logic (no React, no network, no DB).
// Every coefficient, tier, rate and default lives in PRICING_CONFIG so it can be
// changed later without touching the calculator functions. Amounts are in EGP.
// ─────────────────────────────────────────────────────────────────────────────

export const PRICING_CONFIG = Object.freeze({
  // ── Original formula (DO NOT fold server costs into it) ───────────────────
  // BasePrice = BASE_EGP + PER_HOUR_EGP × H + PER_COURSE_EGP × C
  PRICE: Object.freeze({
    BASE_EGP: 16.25,
    PER_HOUR_EGP: 1.1166666667,
    PER_COURSE_EGP: 2,
    ROUNDING_STEP_EGP: 5, // every selling price is rounded UP to a multiple of this
  }),

  // First tier whose minStudents <= S wins (ascending order).
  STUDENT_MULTIPLIERS: Object.freeze([
    Object.freeze({ minStudents: 0,   multiplier: 1.25 }), // < 50
    Object.freeze({ minStudents: 50,  multiplier: 1.15 }), // 50–99
    Object.freeze({ minStudents: 100, multiplier: 1.0 }),  // 100–199
    Object.freeze({ minStudents: 200, multiplier: 0.95 }), // 200–349
    Object.freeze({ minStudents: 350, multiplier: 0.9 }),  // 350+
  ]),

  // ── Provider rates (editable defaults) — all MONTHLY figures ──────────────
  SERVER: Object.freeze({
    STORAGE_USD_PER_GB_MONTH: 0.01,
    BANDWIDTH_USD_PER_GB: 0.005,
    USD_TO_EGP: 58,
    STORAGE_GB_PER_VIDEO_HOUR: 2,
    VIEWING_GB_PER_VIDEO_HOUR: 1,
    VIEWING_PERCENT: 100,
  }),

  // ── Business settings (NOT provider fees) ─────────────────────────────────
  BUSINESS: Object.freeze({
    SAFETY_MARGIN_PERCENT: 20,
    TARGET_PROFIT_MARGIN_PERCENT: 30,
    OPERATING_COST_PER_STUDENT_EGP: 0,
    FIXED_OPERATING_COST_EGP: 0,
    STRATEGY: 'highest',
  }),

  STRATEGIES: Object.freeze(['original', 'minimum', 'target', 'highest']),

  // Sanity ceilings so absurd inputs can never overflow.
  INPUT_LIMITS: Object.freeze({
    students: 10_000_000,
    courses: 100_000,
    hoursPerCourse: 100_000,
    safetyMargin: 1000,
    money: 1e12,
  }),
});

export const STRATEGY_LABELS = Object.freeze({
  original: 'السعر الأصلي (المعادلة)',
  minimum: 'الحد الأدنى الآمن شاملاً التشغيل',
  target: 'سعر الربح المستهدف',
  highest: 'الأعلى بين الثلاثة (افتراضي)',
});

// Default form state (strings, exactly as typed).
export const DEFAULT_INPUTS = Object.freeze({
  students: '',
  courses: '',
  hoursPerCourse: '',
  viewingPercent: String(PRICING_CONFIG.SERVER.VIEWING_PERCENT),
  // provider rates
  storageUsdPerGbMonth: String(PRICING_CONFIG.SERVER.STORAGE_USD_PER_GB_MONTH),
  bandwidthUsdPerGb: String(PRICING_CONFIG.SERVER.BANDWIDTH_USD_PER_GB),
  usdToEgp: String(PRICING_CONFIG.SERVER.USD_TO_EGP),
  storageGbPerHour: String(PRICING_CONFIG.SERVER.STORAGE_GB_PER_VIDEO_HOUR),
  viewingGbPerHour: String(PRICING_CONFIG.SERVER.VIEWING_GB_PER_VIDEO_HOUR),
  // business settings
  safetyMargin: String(PRICING_CONFIG.BUSINESS.SAFETY_MARGIN_PERCENT),
  profitMargin: String(PRICING_CONFIG.BUSINESS.TARGET_PROFIT_MARGIN_PERCENT),
  opCostPerStudent: String(PRICING_CONFIG.BUSINESS.OPERATING_COST_PER_STUDENT_EGP),
  fixedOpCost: String(PRICING_CONFIG.BUSINESS.FIXED_OPERATING_COST_EGP),
  strategy: PRICING_CONFIG.BUSINESS.STRATEGY,
});

// Quick-test scenarios (buttons + tests). Only the four main inputs are set.
export const SCENARIOS = Object.freeze({
  A: Object.freeze({
    label: 'سيناريو A — كورس صغير',
    students: '170', courses: '1', hoursPerCourse: '15', viewingPercent: '100',
    expected: Object.freeze({
      hours: 15, originalPrice: 35, originalRevenue: 5950,
      storageGB: 30, storageCost: 17.4, viewingGB: 2550, bandwidthCost: 739.5,
      totalServerCost: 756.9, serverCostPerStudent: 4.4524, remainingAtOriginal: 5193.1,
    }),
  }),
  B: Object.freeze({
    label: 'سيناريو B — باقة كبيرة',
    students: '170', courses: '13', hoursPerCourse: '15', viewingPercent: '100',
    expected: Object.freeze({
      hours: 195, originalPrice: 260, originalRevenue: 44200,
      storageGB: 390, storageCost: 226.2, viewingGB: 33150, bandwidthCost: 9613.5,
      totalServerCost: 9839.7, serverCostPerStudent: 57.8806, remainingAtOriginal: 34360.3,
    }),
  }),
});

// ── Numeric helpers ──────────────────────────────────────────────────────────
// Kills binary floating-point noise (739.5000000000001 → 739.5) by rounding to
// 6 decimals. Applied before every ceiling and to every stored money value.
const PRECISION = 1e6;
export const clean = (x) => Math.round(x * PRECISION) / PRECISION;

// Round UP to the next multiple of `step` on integer micro-units, so a value that
// is mathematically a multiple of 5 never jumps to the next step.
export function roundUpToStep(value, step = PRICING_CONFIG.PRICE.ROUNDING_STEP_EGP) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const micro = Math.round(value * PRECISION);
  const stepMicro = Math.round(step * PRECISION);
  return Math.max(1, Math.ceil(micro / stepMicro)) * step;
}

// ── Input parsing / validation ───────────────────────────────────────────────
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

// Accepts numbers or strings (incl. Arabic-Indic digits). Returns NaN if invalid/empty.
export function parseNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  if (typeof raw !== 'string') return NaN;
  const cleaned = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[,٬\s]/g, '');
  if (cleaned === '') return NaN;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Validates raw form values → { valid, errors, values }. Messages are Arabic.
// An invalid value is NEVER replaced by a default: it blocks the results.
export function validateInputs(raw = {}, config = PRICING_CONFIG) {
  const errors = {};
  const values = {};
  const L = config.INPUT_LIMITS;
  const fmt = (n) => n.toLocaleString('en-US');

  const check = (field, label, { integer = false, min = 0, minExclusive = true, max }) => {
    const n = parseNumber(raw[field]);
    if (Number.isNaN(n)) errors[field] = `${label}: أدخل رقماً صحيحاً`;
    else if (minExclusive ? n <= min : n < min)
      errors[field] = min === 0 && minExclusive ? `${label}: يجب أن يكون أكبر من صفر` : `${label}: لا يمكن أن يكون أقل من ${min}`;
    else if (integer && !Number.isInteger(n)) errors[field] = `${label}: يجب أن يكون عدداً صحيحاً`;
    else if (n > max) errors[field] = `${label}: القيمة كبيرة جداً (الحد الأقصى ${fmt(max)})`;
    else values[field] = n;
  };

  check('students', 'عدد الطلاب', { integer: true, max: L.students });
  check('courses', 'عدد الكورسات', { integer: true, max: L.courses });
  check('hoursPerCourse', 'متوسط ساعات الفيديو لكل كورس', { max: L.hoursPerCourse });
  check('viewingPercent', 'نسبة المشاهدة', { minExclusive: false, max: 100 }); // 0–100 inclusive

  check('storageUsdPerGbMonth', 'سعر التخزين', { minExclusive: false, max: 1000 });
  check('bandwidthUsdPerGb', 'سعر نقل البيانات', { minExclusive: false, max: 1000 });
  check('usdToEgp', 'سعر الدولار', { max: 100000 });
  check('storageGbPerHour', 'التخزين لكل ساعة', { minExclusive: false, max: 1000 });
  check('viewingGbPerHour', 'استهلاك المشاهدة لكل ساعة', { minExclusive: false, max: 1000 });

  check('safetyMargin', 'هامش الأمان', { minExclusive: false, max: L.safetyMargin });
  // 0 ≤ profit margin < 100
  const pm = parseNumber(raw.profitMargin);
  if (Number.isNaN(pm)) errors.profitMargin = 'هامش الربح المستهدف: أدخل رقماً صحيحاً';
  else if (pm < 0 || pm >= 100) errors.profitMargin = 'هامش الربح المستهدف: يجب أن يكون من 0% وأقل من 100%';
  else values.profitMargin = pm;
  check('opCostPerStudent', 'تكلفة التشغيل الشهرية لكل طالب', { minExclusive: false, max: L.money });
  check('fixedOpCost', 'المصروفات الثابتة الشهرية', { minExclusive: false, max: L.money });

  if (!config.STRATEGIES.includes(raw.strategy)) errors.strategy = 'استراتيجية التسعير غير صالحة';
  else values.strategy = raw.strategy;

  return { valid: Object.keys(errors).length === 0, errors, values };
}

// ── 1) Original formula ──────────────────────────────────────────────────────
export function calcTotalHours({ courses, hoursPerCourse }) {
  return clean(courses * hoursPerCourse); // H = C × h
}

export function getStudentMultiplier(students, config = PRICING_CONFIG) {
  let chosen = config.STUDENT_MULTIPLIERS[0];
  for (const tier of config.STUDENT_MULTIPLIERS) if (students >= tier.minStudents) chosen = tier;
  return chosen;
}

// Base = 16.25 + 1.1166666667·H + 2·C;  Adjusted = Base × multiplier;
// OriginalPrice = CEILING(Adjusted / 5) × 5
export function calcOriginalPrice({ students, courses, hours }, config = PRICING_CONFIG) {
  const P = config.PRICE;
  const basePrice = clean(P.BASE_EGP + P.PER_HOUR_EGP * hours + P.PER_COURSE_EGP * courses);
  const tier = getStudentMultiplier(students, config);
  const adjustedPrice = clean(basePrice * tier.multiplier);
  return { basePrice, studentMultiplier: tier.multiplier, adjustedPrice, originalPrice: roundUpToStep(adjustedPrice, P.ROUNDING_STEP_EGP) };
}

// ── 2) Monthly server costs ──────────────────────────────────────────────────
// Storage: once for the uploaded content (independent of S and V).
// Bandwidth: H × S × V × GB-per-hour (V as a decimal).
export function calcServerCosts(v) {
  const { hours, students, viewingPercent, storageUsdPerGbMonth, bandwidthUsdPerGb, usdToEgp, storageGbPerHour, viewingGbPerHour } = v;
  const storageGB = clean(hours * storageGbPerHour);
  const storageCost = clean(storageGB * storageUsdPerGbMonth * usdToEgp);
  const viewingGB = clean(hours * students * (viewingPercent / 100) * viewingGbPerHour);
  const bandwidthCost = clean(viewingGB * bandwidthUsdPerGb * usdToEgp);
  const totalServerCost = clean(storageCost + bandwidthCost);
  return {
    storageGB, storageCost, viewingGB, bandwidthCost, totalServerCost,
    // allocations (students > 0 is guaranteed by validation)
    storageCostPerStudent: clean(storageCost / students),
    bandwidthCostPerStudent: clean(bandwidthCost / students),
    serverCostPerStudent: clean(totalServerCost / students),
  };
}

// ── 3) Minimum safe prices and target-profit price ───────────────────────────
export function calcSafetyAndTargetPrices({ students, totalServerCost, safetyMargin, profitMargin, opCostPerStudent, fixedOpCost }, config = PRICING_CONFIG) {
  const step = config.PRICE.ROUNDING_STEP_EGP;
  const safeMonthlyServerCost = clean(totalServerCost * (1 + safetyMargin / 100));
  const monthlyOperatingCost = clean(fixedOpCost + students * opCostPerStudent);

  const minimumSafeServerOnlyRaw = clean(safeMonthlyServerCost / students);
  const minimumSafeInclOpRaw = clean((safeMonthlyServerCost + monthlyOperatingCost) / students);
  // Margin on REVENUE (not markup): price = cost / (S × (1 − margin))
  const targetProfitRaw = clean((totalServerCost + monthlyOperatingCost) / (students * (1 - profitMargin / 100)));

  return {
    safeMonthlyServerCost,
    monthlyOperatingCost,
    minimumSafeServerOnlyRaw,
    minimumSafeServerOnly: roundUpToStep(minimumSafeServerOnlyRaw, step),
    minimumSafeInclOpRaw,
    minimumSafeInclOp: roundUpToStep(minimumSafeInclOpRaw, step),
    targetProfitRaw,
    targetProfitPrice: roundUpToStep(targetProfitRaw, step),
  };
}

// ── 4) Strategy selection (never alters the three underlying prices) ────────
export function selectPrice({ strategy, originalPrice, minimumSafeInclOp, targetProfitPrice }) {
  const recommendedFinalPrice = Math.max(originalPrice, minimumSafeInclOp, targetProfitPrice);
  const map = { original: originalPrice, minimum: minimumSafeInclOp, target: targetProfitPrice, highest: recommendedFinalPrice };
  let highestIs = [];
  if (originalPrice === recommendedFinalPrice) highestIs.push('original');
  if (minimumSafeInclOp === recommendedFinalPrice) highestIs.push('minimum');
  if (targetProfitPrice === recommendedFinalPrice) highestIs.push('target');
  return { recommendedFinalPrice, selectedPrice: map[strategy], highestIs };
}

// ── 5) Financials at a given price ───────────────────────────────────────────
// "Remaining" is revenue − modeled monthly server cost. It is NOT net profit.
export function calcFinancials({ price, students, totalServerCost }) {
  const revenue = clean(price * students);
  const remaining = clean(revenue - totalServerCost);
  const ok = Number.isFinite(revenue) && revenue > 0;
  const serverCostPercent = ok ? clean((totalServerCost / revenue) * 100) : null;
  return {
    revenue,
    remaining,
    remainingPerStudent: clean(remaining / students),
    serverCostPercent,
    remainingPercent: ok ? clean(100 - serverCostPercent) : null,
  };
}

// ── One-call entry point used by the UI and the tests ────────────────────────
export function calculatePricing(rawInputs, config = PRICING_CONFIG) {
  const { valid, errors, values } = validateInputs(rawInputs, config);
  if (!valid) return { ok: false, errors, results: null };

  const hours = calcTotalHours(values);
  const original = calcOriginalPrice({ students: values.students, courses: values.courses, hours }, config);
  const server = calcServerCosts({ hours, ...values });
  const prices = calcSafetyAndTargetPrices({ students: values.students, totalServerCost: server.totalServerCost, ...values }, config);
  const sel = selectPrice({ strategy: values.strategy, originalPrice: original.originalPrice, minimumSafeInclOp: prices.minimumSafeInclOp, targetProfitPrice: prices.targetProfitPrice });

  const base = { students: values.students, totalServerCost: server.totalServerCost };
  const atSelected = calcFinancials({ price: sel.selectedPrice, ...base });
  const atOriginal = calcFinancials({ price: original.originalPrice, ...base });

  return {
    ok: true,
    errors: {},
    results: { inputs: values, hours, ...original, ...server, ...prices, ...sel, atSelected, atOriginal },
  };
}
