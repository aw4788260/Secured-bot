import { supabase } from './supabaseClient';
import admin from './firebaseAdmin';

// 🚀 =========================================================
// 🚀 القائمة البيضاء لتجاوز فحص Firebase App Check
// 🚀 =========================================================
// تُستخدم لحالات معينة (مثل هواتف هواوي التي لا تملك خدمات جوجل بلاي
// ولا يمكنها إنتاج App Check token صالح). الأدمن يضيف عبر لوحة التحكم
// اسم المستخدم أو رقم الهاتف أو user_id للمستخدم المتأثر، ويقوم
// النظام تلقائياً باستخراج وتخزين user_id الحقيقي. بعدها تُقبل طلبات
// هذا المستخدم حتى بدون توكن App Check.
// ملاحظة: شاشة التسجيل (signup) لم تعد تتحقق من App Check إطلاقاً،
// لذلك هذا التطابق يخص باقي نقاط الدخول (login وغيرها) فقط.
//
// الجدول المطلوب في Supabase (شغّل هذا الأمر مرة واحدة):
//
// create table if not exists public.app_check_whitelist (
//   id bigint generated always as identity primary key,
//   value text not null unique,
//   label text,
//   note text,
//   is_active boolean not null default true,
//   created_at timestamptz not null default now()
// );

let whitelistCache = { set: new Set(), expiry: 0 };
const WHITELIST_CACHE_TTL = 60 * 1000; // دقيقة واحدة - تحديث سريع بعد أي تعديل من الأدمن

async function loadWhitelistSet() {
  const now = Date.now();
  if (whitelistCache.expiry > now) return whitelistCache.set;

  try {
    const { data, error } = await supabase
      .from('app_check_whitelist')
      .select('value')
      .eq('is_active', true);

    if (error) throw error;

    const set = new Set(
      (data || [])
        .map((row) => (row.value ? String(row.value).trim().toLowerCase() : null))
        .filter(Boolean)
    );

    whitelistCache = { set, expiry: now + WHITELIST_CACHE_TTL };
    return set;
  } catch (err) {
    console.error('❌ [AppCheckWhitelist] Failed to load whitelist:', err.message);
    // في حال فشل الاتصال بقاعدة البيانات، نُبقي الكاش القديم (إن وجد) بدل تفريغه بالكامل
    return whitelistCache.set;
  }
}

/**
 * يفرض إعادة تحميل القائمة البيضاء في الطلب القادم (اختياري - يُستخدم بعد التعديل من لوحة التحكم)
 */
export function invalidateAppCheckWhitelistCache() {
  whitelistCache = { set: new Set(), expiry: 0 };
}

/**
 * يتحقق مما إذا كان أي من المعرّفات المُمررة (device id, username, phone, user id...)
 * موجوداً ومُفعّلاً في القائمة البيضاء.
 */
export async function isAppCheckWhitelisted(candidates = []) {
  const cleaned = candidates
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v.length > 0);

  if (cleaned.length === 0) return false;

  const set = await loadWhitelistSet();
  return cleaned.some((value) => set.has(value));
}

/**
 * دالة موحدة للتحقق من Firebase App Check مع مراعاة القائمة البيضاء.
 * تُستخدم في كل مكان يتم فيه التحقق من App Check بدلاً من تكرار نفس المنطق.
 *
 * ترجع:
 *  - { ok: true, viaWhitelist: boolean } في حال النجاح
 *  - { ok: false, status, message } في حال الفشل (يُستخدم للرد مباشرة على الطلب)
 *
 * @param {object} req - كائن الطلب (Next.js request)
 * @param {Array<string|null|undefined>} candidates - القيم التي يمكن مطابقتها بالقائمة البيضاء
 * @param {string} logTag - وسم يظهر في اللوجات لتسهيل التتبع
 */
export async function verifyAppCheckWithWhitelist(req, candidates = [], logTag = 'AppCheck') {
  // 1. تجاوز الفحص بالكامل إذا كان أحد المعرّفات ضمن القائمة البيضاء
  if (await isAppCheckWhitelisted(candidates)) {
    console.log(`✅ [${logTag}] App Check Bypassed (Whitelisted)`);
    return { ok: true, viaWhitelist: true };
  }

  // 2. التحقق العادي عبر Firebase App Check
  const appCheckToken = req.headers['x-firebase-appcheck'];

  if (!appCheckToken) {
    console.error(`❌ [${logTag}] Missing App Check Token`);
    return { ok: false, status: 401, message: 'Unauthorized: Missing App Check token' };
  }

  try {
    await admin.appCheck().verifyToken(appCheckToken);
    return { ok: true, viaWhitelist: false };
  } catch (appCheckError) {
    console.error(`❌ [${logTag}] App Check Failed:`, appCheckError.message);
    return { ok: false, status: 401, message: 'Unauthorized: Invalid App Check token' };
  }
}
