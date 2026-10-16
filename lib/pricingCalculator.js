// lib/pricingCalculator.js
// ─────────────────────────────────────────────────────────────────────────────
// Madad pricing calculator — pure calculation logic (no React, no network, no DB).
// All coefficients, multipliers and provider rates live in PRICING_CONFIG so
// they can be changed later without rewriting the calculator.
// All money amounts are in EGP.
// ─────────────────────────────────────────────────────────────────────────────

export const PRICING_CONFIG = Object.freeze({
  // ── Pricing model ──────────────────────────────────────────────────────────
  // BasePrice = BASE_EGP + PER_HOUR_EGP × H + PER_COURSE_EGP × C
  PRICE: Object.freeze({
    BASE_EGP: 16.25,
    PER_HOUR_EGP: 1.1166666667,
    PER_COURSE_EGP: 2,
    ROUNDING_STEP_EGP: 5, // final price is rounded UP to a multiple of this
  }),

  // Volume-discount policy. First tier whose `minStudents` <= S wins
  // (tiers must be sorted by minStudents, ascending).
  STUDENT_MULTIPLIERS: Object.freeze([
    Object.freeze({ minStudents: 0,   multiplier: 1.25 }), // < 50
    Object.freeze({ minStudents: 50,  multiplier: 1.15 }), // 50–99
    Object.freeze({ minStudents: 100, multiplier: 1.0 }),  // 100–199
    Object.freeze({ minStudents: 200, multiplier: 0.95 }), // 200–349
    Object.freeze({ minStudents: 350, multiplier: 0.9 }),  // 350+
  ]),

  // ── Server cost model (editable defaults) ─────────────────────────────────
  SERVER: Object.freeze({
    STORAGE_USD_PER_GB_MONTH: 0.01, // storage is billed MONTHLY
    BANDWIDTH_USD_PER_GB: 0.005,    // data transfer, per GB delivered
    USD_TO_EGP: 58,
    STORAGE_GB_PER_VIDEO_HOUR: 2,   // GB stored per uploaded hour
    VIEWING_GB_PER_VIDEO_HOUR: 1,   // GB streamed per hour watched by one student
    STORAGE_MONTHS: 1,              // how many monthly storage bills to show (1 = one month)
    VIEWING_PERCENT: 100,           // % of content each student watches
  }),

  // Sanity ceilings so absurd inputs can never overflow.
  INPUT_LIMITS: Object.freeze({
    students: 10_000_000,
    courses: 100_000,
    hoursPerCourse: 100_000,
    months: 1200,
  }),
});

// Default form state (all values are strings, as typed by the user).
export const DEFAULT_INPUTS = Object.freeze({
  students: '',
  courses: '',
  hoursPerCourse: '',
  viewingPercent: String(PRICING_CONFIG.SERVER.VIEWING_PERCENT),
  storageUsdPerGbMonth: String(PRICING_CONFIG.SERVER.STORAGE_USD_PER_GB_MONTH),
  bandwidthUsdPerGb: String(PRICING_CONFIG.SERVER.BANDWIDTH_USD_PER_GB),
  usdToEgp: String(PRICING_CONFIG.SERVER.USD_TO_EGP),
  storageGbPerHour: String(PRICING_CONFIG.SERVER.STORAGE_GB_PER_VIDEO_HOUR),
  viewingGbPerHour: String(PRICING_CONFIG.SERVER.VIEWING_GB_PER_VIDEO_HOUR),
  storageMonths: String(PRICING_CONFIG.SERVER.STORAGE_MONTHS),
});

// Verified benchmark scenarios (quick-test buttons + unit tests).
export const SCENARIOS = Object.freeze({
  A: Object.freeze({
    label: 'سيناريو A — كورس صغير',
    students: '170', courses: '1', hoursPerCourse: '15',
    expected: Object.freeze({
      hours: 15, pricePerStudent: 35, revenue: 5950,
      storageGB: 30, storageCost: 17.4, viewingGB: 2550, bandwidthCost: 739.5,
      totalServerCost: 756.9, remaining: 5193.1,
    }),
  }),
  B: Object.freeze({
    label: 'سيناريو B — باقة كورسات كبيرة',
    students: '170', courses: '13', hoursPerCourse: '15',
    expected: Object.freeze({
      hours: 195, pricePerStudent: 260, revenue: 44200,
      storageGB: 390, storageCost: 226.2, viewingGB: 33150, bandwidthCost: 9613.5,
      totalServerCost: 9839.7, remaining: 34360.3,
    }),
  }),
});

// ── Numeric helpers ──────────────────────────────────────────────────────────
// Kills binary floating-point noise (e.g. 739.5000000000001) by rounding to
// 6 decimals. Used before every ceiling and before every displayed money value.
const PRECISION = 1e6;
export const clean = (x) => Math.round(x * PRECISION) / PRECISION;

// Round UP to the next multiple of `step`, working on integer micro-units so
// that values that are *mathematically* a multiple of 5 never jump a step.
export function roundUpToStep(value, step = PRICING_CONFIG.PRICE.ROUNDING_STEP_EGP) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const micro = Math.round(value * PRECISION);
  const stepMicro = Math.round(step * PRECISION);
  return Math.max(1, Math.ceil(micro / stepMicro)) * step;
}

// ── Input parsing / validation ───────────────────────────────────────────────
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

// Accepts numbers or strings (incl. Arabic-Indic digits). Returns NaN when invalid/empty.
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
export function validateInputs(raw = {}, config = PRICING_CONFIG) {
  const errors = {};
  const values = {};
  const L = config.INPUT_LIMITS;
  const fmt = (n) => n.toLocaleString('en-US');

  const positive = (field, label, { integer = false, max }) => {
    const n = parseNumber(raw[field]);
    if (Number.isNaN(n)) errors[field] = `${label}: أدخل رقماً صحيحاً`;
    else if (n <= 0) errors[field] = `${label}: يجب أن يكون أكبر من صفر`;
    else if (integer && !Number.isInteger(n)) errors[field] = `${label}: يجب أن يكون عدداً صحيحاً`;
    else if (n > max) errors[field] = `${label}: القيمة كبيرة جداً (الحد الأقصى ${fmt(max)})`;
    else values[field] = n;
  };
  const nonNegative = (field, label, { max = Infinity } = {}) => {
    const n = parseNumber(raw[field]);
    if (Number.isNaN(n)) errors[field] = `${label}: أدخل رقماً صحيحاً`;
    else if (n < 0) errors[field] = `${label}: لا يمكن أن يكون سالباً`;
    else if (n > max) errors[field] = `${label}: القيمة كبيرة جداً`;
    else values[field] = n;
  };

  positive('students', 'عدد الطلاب', { integer: true, max: L.students });
  positive('courses', 'عدد الكورسات', { integer: true, max: L.courses });
  positive('hoursPerCourse', 'متوسط ساعات الفيديو لكل كورس', { max: L.hoursPerCourse });

  // Viewing percentage: 0–100
  const v = parseNumber(raw.viewingPercent);
  if (Number.isNaN(v) || v < 0 || v > 100) errors.viewingPercent = 'نسبة المشاهدة: يجب أن تكون بين 0% و100%';
  else values.viewingPercent = v;

  // Editable server rates
  nonNegative('storageUsdPerGbMonth', 'سعر التخزين', { max: 1000 });
  nonNegative('bandwidthUsdPerGb', 'سعر نقل البيانات', { max: 1000 });
  positive('usdToEgp', 'سعر الدولار', { max: 100000 });
  nonNegative('storageGbPerHour', 'التخزين لكل ساعة', { max: 1000 });
  nonNegative('viewingGbPerHour', 'استهلاك المشاهدة لكل ساعة', { max: 1000 });
  positive('storageMonths', 'عدد أشهر التخزين', { integer: true, max: L.months });

  return { valid: Object.keys(errors).length === 0, errors, values };
}

// ── Pricing model ────────────────────────────────────────────────────────────
// H = C × h
export function calcTotalHours({ courses, hoursPerCourse }) {
  return clean(courses * hoursPerCourse);
}

// Multiplier tier for a student count.
export function getStudentMultiplier(students, config = PRICING_CONFIG) {
  let chosen = config.STUDENT_MULTIPLIERS[0];
  for (const tier of config.STUDENT_MULTIPLIERS) {
    if (students >= tier.minStudents) chosen = tier;
  }
  return chosen;
}

// BasePrice = 16.25 + 1.1166666667 × H + 2 × C
// AdjustedPrice = BasePrice × multiplier;  PricePerStudent = CEILING(Adjusted / 5) × 5
export function calcPrice({ students, courses, hours }, config = PRICING_CONFIG) {
  const P = config.PRICE;
  const basePrice = clean(P.BASE_EGP + P.PER_HOUR_EGP * hours + P.PER_COURSE_EGP * courses);
  const tier = getStudentMultiplier(students, config);
  const adjustedPrice = clean(basePrice * tier.multiplier);
  const pricePerStudent = roundUpToStep(adjustedPrice, P.ROUNDING_STEP_EGP);
  return { basePrice, studentMultiplier: tier.multiplier, adjustedPrice, pricePerStudent };
}

// ── Server cost model ────────────────────────────────────────────────────────
// Storage: once per uploaded hour (NOT per student), billed MONTHLY.
// Bandwidth: H × S × V × GB-per-hour (viewing % does NOT affect storage).
export function calcServerCosts(
  { hours, students, viewingPercent, storageUsdPerGbMonth, bandwidthUsdPerGb, usdToEgp, storageGbPerHour, viewingGbPerHour, storageMonths },
) {
  const storageGB = clean(hours * storageGbPerHour);
  const storageCostMonthly = clean(storageGB * storageUsdPerGbMonth * usdToEgp);
  const storageCostTotal = clean(storageCostMonthly * storageMonths);
  const viewingGB = clean(hours * students * (viewingPercent / 100) * viewingGbPerHour);
  const bandwidthCost = clean(viewingGB * bandwidthUsdPerGb * usdToEgp);
  const totalServerCost = clean(storageCostTotal + bandwidthCost);
  return { storageGB, storageCostMonthly, storageCostTotal, viewingGB, bandwidthCost, totalServerCost };
}

// Revenue indicators. "Remaining" is NOT net profit.
export function calcFinancials({ pricePerStudent, students, totalServerCost }) {
  const revenue = clean(pricePerStudent * students);
  const remaining = clean(revenue - totalServerCost);
  const revenueValid = Number.isFinite(revenue) && revenue > 0;
  return {
    revenue,
    remaining,
    serverCostPercent: revenueValid ? clean((totalServerCost / revenue) * 100) : null,
    remainingPercent: revenueValid ? clean((remaining / revenue) * 100) : null,
  };
}

// ── One-call entry point used by the UI and the tests ────────────────────────
export function calculatePricing(rawInputs, config = PRICING_CONFIG) {
  const { valid, errors, values } = validateInputs(rawInputs, config);
  if (!valid) return { ok: false, errors, results: null };

  const hours = calcTotalHours(values);
  const price = calcPrice({ students: values.students, courses: values.courses, hours }, config);
  const server = calcServerCosts({ hours, ...values });
  const fin = calcFinancials({
    pricePerStudent: price.pricePerStudent,
    students: values.students,
    totalServerCost: server.totalServerCost,
  });
  return { ok: true, errors: {}, results: { inputs: values, hours, ...price, ...server, ...fin } };
      }
