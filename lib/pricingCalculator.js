// lib/pricingCalculator.js
// ─────────────────────────────────────────────────────────────────────────────
// Smart Pricing Calculator — pure calculation logic (no React, no network, no DB).
// The formulas, exponents, default values and rounding rules follow the
// approved specification exactly. Only the constants in PRICING_CONFIG are
// meant to be adjusted in the future.
// ─────────────────────────────────────────────────────────────────────────────

// ── Configurable constants (initial values match the specification) ──────────
export const PRICING_CONFIG = Object.freeze({
  USD_TO_EGP: 58.5,                    // EGP per 1 USD
  STORAGE_USD_PER_GB_MONTH: 0.01,      // $ per GB per month
  VIEWING_USD_PER_GB: 0.005,           // $ per GB transferred
  STORAGE_GB_PER_VIDEO_HOUR: 2,        // GB stored per hour of uploaded video
  VIEWING_GB_PER_VIDEO_HOUR: 1,        // GB consumed per hour actually watched (upper bound)
  VIEWS_PER_STUDENT: 1,                // each student watches each video once

  ROUNDING_STEP_EGP: 5,                // prices are rounded UP to a multiple of this

  // Market-oriented reference price: 110 × (200/N)^0.35 × (H/90)^0.25 × (M/6)^0.15
  MARKET: Object.freeze({
    BASE_PRICE_EGP: 110,
    REFERENCE_STUDENTS: 200,
    REFERENCE_HOURS: 90,
    REFERENCE_MONTHS: 6,
    STUDENTS_EXPONENT: 0.35,
    HOURS_EXPONENT: 0.25,
    MONTHS_EXPONENT: 0.15,
  }),

  ACCESS_DURATION_OPTIONS: Object.freeze([2, 3, 4, 6, 9, 12]),

  SAFETY_MARGIN: Object.freeze({ min: 0, max: 50, step: 5, default: 20 }),
  PROFIT_MARGIN: Object.freeze({ min: 10, max: 60, step: 5, default: 35 }),

  // Sanity ceilings so absurd inputs can never overflow to Infinity.
  INPUT_LIMITS: Object.freeze({
    students: 10_000_000,
    courses: 100_000,
    videosPerCourse: 100_000,
    videoMinutes: 100_000,
  }),
});

// ── Default example (section 12 of the specification) ────────────────────────
export const DEFAULT_INPUTS = Object.freeze({
  students: '200',
  courses: '3',
  videosPerCourse: '30',
  videoMinutes: '60',
  months: 6,
  safetyMargin: PRICING_CONFIG.SAFETY_MARGIN.default,
  profitMargin: PRICING_CONFIG.PROFIT_MARGIN.default,
});

// Per-GB rates in EGP, derived from the USD constants.
export function getRates(config = PRICING_CONFIG) {
  return {
    storageRate: config.STORAGE_USD_PER_GB_MONTH * config.USD_TO_EGP, // 0.585 EGP / GB / month
    viewingRate: config.VIEWING_USD_PER_GB * config.USD_TO_EGP,       // 0.2925 EGP / GB
  };
}

// Absorbs binary floating-point noise (e.g. 22.000000000000004) before ceiling.
const CEIL_EPSILON = 1e-9;

// Round UP to the next multiple of `step` (default 5 EGP). Positive values never become 0.
export function roundUpToStep(value, step = PRICING_CONFIG.ROUNDING_STEP_EGP) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const units = Math.ceil(value / step - CEIL_EPSILON);
  return Math.max(1, units) * step;
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

// Validates raw form values. Returns { valid, errors, values }.
// `errors` maps a field name to an Arabic message; `values` holds parsed numbers.
export function validateInputs(raw = {}, config = PRICING_CONFIG) {
  const errors = {};
  const values = {};
  const L = config.INPUT_LIMITS;

  const positive = (field, label, { integer = false, max }) => {
    const n = parseNumber(raw[field]);
    if (Number.isNaN(n)) errors[field] = `${label}: أدخل رقماً صحيحاً`;
    else if (n <= 0) errors[field] = `${label}: يجب أن يكون أكبر من صفر`;
    else if (integer && !Number.isInteger(n)) errors[field] = `${label}: يجب أن يكون عدداً صحيحاً`;
    else if (n > max) errors[field] = `${label}: القيمة كبيرة جداً (الحد الأقصى ${max.toLocaleString('en-US')})`;
    else values[field] = n;
  };

  positive('students', 'عدد الطلاب', { integer: true, max: L.students });
  positive('courses', 'عدد الكورسات', { integer: true, max: L.courses });
  positive('videosPerCourse', 'متوسط عدد الفيديوهات لكل كورس', { max: L.videosPerCourse });
  positive('videoMinutes', 'متوسط مدة الفيديو (بالدقائق)', { max: L.videoMinutes });

  const months = parseNumber(raw.months);
  if (!config.ACCESS_DURATION_OPTIONS.includes(months)) errors.months = 'مدة الاشتراك: اختر قيمة من القائمة';
  else values.months = months;

  const inRange = (field, label, r) => {
    const n = parseNumber(raw[field]);
    if (Number.isNaN(n) || n < r.min || n > r.max) errors[field] = `${label}: يجب أن تكون بين ${r.min}% و${r.max}%`;
    else values[field] = n;
  };
  inRange('safetyMargin', 'هامش الأمان', config.SAFETY_MARGIN);
  inRange('profitMargin', 'هامش الربح المستهدف', config.PROFIT_MARGIN);

  return { valid: Object.keys(errors).length === 0, errors, values };
}

// ── Core formulas (section 4–10 of the specification) ────────────────────────

// Total video hours: H = C × V × (T / 60)
export function calcTotalHours({ courses, videosPerCourse, videoMinutes }) {
  return courses * videosPerCourse * (videoMinutes / 60);
}

// Server costs (EGP): storage for the whole access period + viewing transfer.
export function calcServerCosts({ hours, students, months }, config = PRICING_CONFIG) {
  const { storageRate, viewingRate } = getRates(config);
  const storageGB = hours * config.STORAGE_GB_PER_VIDEO_HOUR;                       // StorageGB = H × 2
  const storageCost = storageGB * storageRate * months;                              // StorageGB × StorageRate × M
  const viewingGB = hours * students * config.VIEWING_GB_PER_VIDEO_HOUR * config.VIEWS_PER_STUDENT;
  const viewingCost = viewingGB * viewingRate;                                       // H × N × ViewingRate
  const totalServerCost = storageCost + viewingCost;
  return {
    storageGB,
    storageCost,
    viewingGB,
    viewingCost,
    totalServerCost,
    serverCostPerStudent: totalServerCost / students,
  };
}

// Minimum safe price per student.
//   Adjusted = CostPerStudent × (1 + Safety/100)
//   MinSafe  = Adjusted / (1 − Profit/100)       (gross margin, NOT markup)
export function calcMinimumSafePrice({ serverCostPerStudent, safetyMargin, profitMargin }, config = PRICING_CONFIG) {
  const adjustedCostPerStudent = serverCostPerStudent * (1 + safetyMargin / 100);
  const minimumSafePrice = adjustedCostPerStudent / (1 - profitMargin / 100);
  return {
    adjustedCostPerStudent,
    minimumSafePrice,
    minimumPriceRounded: roundUpToStep(minimumSafePrice, config.ROUNDING_STEP_EGP),
  };
}

// Market reference price: 110 × (200/N)^0.35 × (H/90)^0.25 × (M/6)^0.15
export function calcMarketPrice({ students, hours, months }, config = PRICING_CONFIG) {
  const m = config.MARKET;
  const marketPrice =
    m.BASE_PRICE_EGP *
    Math.pow(m.REFERENCE_STUDENTS / students, m.STUDENTS_EXPONENT) *
    Math.pow(hours / m.REFERENCE_HOURS, m.HOURS_EXPONENT) *
    Math.pow(months / m.REFERENCE_MONTHS, m.MONTHS_EXPONENT);
  return { marketPrice, marketPriceRounded: roundUpToStep(marketPrice, config.ROUNDING_STEP_EGP) };
}

// Final price = MAX(rounded market, rounded minimum). Also says which one decided it.
export function calcCompetitivePrice(marketPriceRounded, minimumPriceRounded) {
  const competitivePrice = Math.max(marketPriceRounded, minimumPriceRounded);
  let determinedBy = 'equal';
  if (marketPriceRounded > minimumPriceRounded) determinedBy = 'market';
  else if (minimumPriceRounded > marketPriceRounded) determinedBy = 'minimum';
  return { competitivePrice, determinedBy };
}

// Revenue indicators. The margin counts SERVER COSTS ONLY (not net profit).
export function calcFinancials({ competitivePrice, students, totalServerCost }) {
  const totalRevenue = competitivePrice * students;
  const amountAfterServerCosts = totalRevenue - totalServerCost;
  const revenueValid = Number.isFinite(totalRevenue) && totalRevenue > 0;
  return {
    totalRevenue,
    amountAfterServerCosts,
    grossMarginPercent: revenueValid ? (amountAfterServerCosts / totalRevenue) * 100 : null,
    marginError: revenueValid ? null : 'لا يمكن حساب الهامش: إجمالي الإيراد صفر أو غير صالح',
  };
}

// ── One-call entry point used by the UI ──────────────────────────────────────
// Returns { ok:false, errors } for invalid input, otherwise { ok:true, results }.
export function calculatePricing(rawInputs, config = PRICING_CONFIG) {
  const { valid, errors, values } = validateInputs(rawInputs, config);
  if (!valid) return { ok: false, errors, results: null };

  const hours = calcTotalHours(values);
  const server = calcServerCosts({ hours, students: values.students, months: values.months }, config);
  const minimum = calcMinimumSafePrice(
    { serverCostPerStudent: server.serverCostPerStudent, safetyMargin: values.safetyMargin, profitMargin: values.profitMargin },
    config
  );
  const market = calcMarketPrice({ students: values.students, hours, months: values.months }, config);
  const final = calcCompetitivePrice(market.marketPriceRounded, minimum.minimumPriceRounded);
  const financials = calcFinancials({
    competitivePrice: final.competitivePrice,
    students: values.students,
    totalServerCost: server.totalServerCost,
  });

  return {
    ok: true,
    errors: {},
    results: {
      inputs: values,
      hours,
      ...server,
      ...minimum,
      ...market,
      ...final,
      ...financials,
    },
  };
}
