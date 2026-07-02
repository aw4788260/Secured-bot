// lib/playerSettingsHelper.js
//
// ✅ نظام إعدادات المشغلات الديناميكي
// -------------------------------------------------------------
// بدلاً من 3 خانات ثابتة (player_1 / player_2 / player_3) أصبح
// عدد المشغلات غير محدود: مصفوفة "players" يمكن للأدمن أن يضيف
// أو يحذف أو يعدّل أي عدد منها من لوحة التحكم.
//
// كل مشغل (player) لا يحمل فقط اسم/وصف/ترتيب، بل أيضاً حقل
// "engine" الذي يحدد **مصدر الفيديو ومنطق الجلب** الذي يجب أن
// يستخدمه التطبيق لهذا المشغل تحديداً. هذا هو المفتاح الذي يسمح
// بإضافة مشغلات جديدة دون تعديل الكود في كل مرة (الأدمن فقط يختار
// الـ engine المناسب عند إنشاء مشغل جديد).
//
// القيم المدعومة حالياً لـ engine:
//   - "explode_direct" : استخراج مباشر لروابط الفيديو (get-stream-proxy)
//   - "bunny_hls"       : Bunny Stream عبر get-video-id (HLS + قوائم جودة)
//   - "youtube"         : تشغيل عبر مشغل يوتيوب المدمج (يتطلب youtube_video_id)
//
// أي مشغل جديد بنفس مصدر بيانات موجود (مثلاً مشغل بديل يستخدم نفس
// بيانات Bunny القادمة من get-video-id) يكفي أن يحمل engine: "bunny_hls"
// - لا حاجة لأي تعديل في get-video-id.js نفسه.

// المشغلات الافتراضية (تُستخدم فقط إذا لم يوجد أي إعداد محفوظ في قاعدة البيانات)
const DEFAULT_PLAYERS = [
  {
    id: 'player_1',
    engine: 'explode_direct',
    enabled: true,
    name: 'المشغل الأساسي',
    description: 'سريع ومستقر (ينصح به)',
    order: 1,
  },
  {
    id: 'player_2',
    engine: 'bunny_hls',
    enabled: true,
    name: 'سيرفر احتياطي',
    description: 'استخدمه في حال التقطيع',
    order: 2,
  },
  {
    id: 'player_3',
    engine: 'youtube',
    enabled: true,
    name: 'مشغل يوتيوب',
    description: 'جودة متعددة',
    order: 3,
  },
  {
    id: 'player_4',
    engine: 'bunny_native',
    enabled: false,
    name: 'مشغل بديل',
    description: 'جرّب هذا إذا واجهت مشاكل في التشغيل مع المشغلات الأخرى',
    order: 4,
  },
];

const DEFAULT_DOWNLOADS = { video_enabled: true, pdf_enabled: true };

// قائمة الـ engines المسموح بها (لأغراض التحقق/الفاليديشن)
// - explode_direct : استخراج مباشر لروابط الفيديو (get-stream-proxy)
// - bunny_hls       : Bunny Stream عبر get-video-id، يُشغَّل بواجهة media_kit
// - bunny_native     : ✅ نفس بيانات Bunny Stream (get-video-id) تماماً، لكن
//                       يُشغَّل بواجهة مشغل مختلفة (video_player/ExoPlayer الأصلي)
//                       بدلاً من media_kit، لحل مشاكل التوافق على بعض الأجهزة.
// - youtube         : تشغيل عبر مشغل يوتيوب المدمج (يتطلب youtube_video_id)
export const VALID_ENGINES = ['explode_direct', 'bunny_hls', 'bunny_native', 'youtube'];

export function defaultPlayerSettings() {
  return {
    players: DEFAULT_PLAYERS.map((p) => ({ ...p })),
    downloads: { ...DEFAULT_DOWNLOADS },
  };
}

// يولّد معرّف فريد لمشغل جديد
export function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ===================================================================
// ✅ Normalization: يحوّل أي شكل قديم (player_1/player_2/player_3 كخصائص
// ثابتة في الكائن) إلى الشكل الجديد { players: [...], downloads: {...} }
// حتى لا تنكسر البيانات القديمة المخزنة في قاعدة البيانات قبل هذا التحديث،
// وحتى تتحول تلقائياً لأول مرة يُفتح فيها الأدمن أو يُستدعى فيها أي API.
// ===================================================================
export function normalizePlayerSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return defaultPlayerSettings();
  }

  // الشكل الجديد بالفعل
  if (Array.isArray(raw.players)) {
    const players = raw.players
      .filter((p) => p && typeof p === 'object' && p.id)
      .map((p, idx) => ({
        id: String(p.id),
        engine: VALID_ENGINES.includes(p.engine) ? p.engine : 'bunny_hls',
        enabled: p.enabled !== false,
        name: p.name || `مشغل ${idx + 1}`,
        description: p.description || '',
        order: Number.isFinite(Number(p.order)) ? Number(p.order) : idx + 1,
      }));

    return {
      players: players.length > 0 ? players : defaultPlayerSettings().players,
      downloads: {
        video_enabled: raw.downloads?.video_enabled !== false,
        pdf_enabled: raw.downloads?.pdf_enabled !== false,
      },
    };
  }

  // الشكل القديم: player_1 / player_2 / player_3 كخصائص ثابتة
  const legacyKeys = ['player_1', 'player_2', 'player_3'];
  const legacyEngineMap = {
    player_1: 'explode_direct',
    player_2: 'bunny_hls',
    player_3: 'youtube',
  };

  const foundLegacy = legacyKeys.some((k) => raw[k] && typeof raw[k] === 'object');

  if (foundLegacy) {
    const players = legacyKeys
      .filter((k) => raw[k] && typeof raw[k] === 'object')
      .map((k, idx) => ({
        id: k,
        engine: legacyEngineMap[k] || 'bunny_hls',
        enabled: raw[k].enabled !== false,
        name: raw[k].name || `مشغل ${idx + 1}`,
        description: raw[k].description || '',
        order: Number.isFinite(Number(raw[k].order)) ? Number(raw[k].order) : idx + 1,
      }));

    return {
      players,
      downloads: {
        video_enabled: raw.downloads?.video_enabled !== false,
        pdf_enabled: raw.downloads?.pdf_enabled !== false,
      },
    };
  }

  // شكل غير معروف -> رجوع للافتراضي
  return defaultPlayerSettings();
}

// يحوّل نص JSON (كما هو مخزّن في app_settings.value) إلى إعدادات مطبّعة
export function parsePlayerSettings(jsonString) {
  if (!jsonString) return defaultPlayerSettings();
  try {
    const parsed = JSON.parse(jsonString);
    return normalizePlayerSettings(parsed);
  } catch (e) {
    console.error('parsePlayerSettings: failed to parse JSON', e.message);
    return defaultPlayerSettings();
  }
}

// تحقق بسيط قبل الحفظ من لوحة التحكم (يُستخدم في API الحفظ)
export function validatePlayerSettingsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Invalid player settings payload';
  }
  if (!Array.isArray(payload.players)) {
    return 'players must be an array';
  }
  for (const p of payload.players) {
    if (!p || typeof p !== 'object') return 'Each player must be an object';
    if (!p.id || typeof p.id !== 'string') return 'Each player must have a string id';
    if (!p.name || typeof p.name !== 'string') return 'Each player must have a name';
    if (!VALID_ENGINES.includes(p.engine)) {
      return `Invalid engine "${p.engine}". Must be one of: ${VALID_ENGINES.join(', ')}`;
    }
  }
  const ids = payload.players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    return 'Player ids must be unique';
  }
  return null; // valid
}
