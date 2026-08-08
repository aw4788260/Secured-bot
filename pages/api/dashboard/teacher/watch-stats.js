import { db } from '../../../../lib/firebaseAdmin';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

// ============================================================================
// 📺 إحصائيات المشاهدات اليومية لآخر 7 أيام — تعتمد على مجموعة Firebase
// الموجودة بالفعل: video_views (نفس المصدر المستخدم في get-video-views.js)
// ============================================================================
// ⚠️ ملاحظة مهمة عن طبيعة البيانات:
// كل مستند في video_views يمثل (فيديو + طالب) واحد فقط، ويتم تحديث حقل
// lastViewedAt في كل مرة يشاهد فيها هذا الطالب هذا الفيديو (merge: true).
// أي أن المستند يحتفظ فقط بـ "آخر" وقت مشاهدة، وليس بكل مشاهدة على حدة.
// لذلك فإن الرسم البياني هنا يُحسب بعدد أزواج (فيديو، طالب) التي كان
// "آخر ظهور" لها في كل يوم — وهو أقرب تقدير ممكن لعدد المشاهدات اليومية
// بدون تغيير طريقة التسجيل الحالية في Firebase.
// ============================================================================

const getEgyptOffset = (dateInput) => {
  try {
    const date = new Date(dateInput);
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'shortOffset' });
    const parts = fmt.formatToParts(date);
    const offsetString = parts.find(p => p.type === 'timeZoneName').value;
    const hours = parseInt(offsetString.replace(/[^\d+-]/g, '')) || 2;
    const sign = hours >= 0 ? '+' : '-';
    const paddedHours = Math.abs(hours).toString().padStart(2, '0');
    return `${sign}${paddedHours}:00`;
  } catch (e) {
    return '+02:00';
  }
};

const cairoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
});
const getCairoDateStr = (date) => cairoDateFormatter.format(date);

const shiftDateStr = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const getDayNameFromDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return daysMap[new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()];
};

const DAYS = 7;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const teacherId = user.teacherId ? user.teacherId.toString() : null;
  if (!teacherId && user.role !== 'super_admin') {
    return res.status(400).json({ success: false, error: 'لم يتم العثور على بروفايل المدرس' });
  }

  try {
    const todayCairoStr = getCairoDateStr(new Date());
    const localLimitDateStr = shiftDateStr(todayCairoStr, -(DAYS - 1));

    // ✅ بداية النطاق الزمني (منتصف ليل اليوم الأول من الأيام السبعة بتوقيت القاهرة)
    const rangeStartOffset = getEgyptOffset(`${localLimitDateStr}T00:00:00`);
    const rangeStart = new Date(`${localLimitDateStr}T00:00:00${rangeStartOffset}`);

    // بناء الاستعلام على مجموعة video_views الموجودة بالفعل في Firebase
    // ✅ نفلتر دائماً حسب teacherId طالما الحساب مرتبط بملف مدرس — حتى لو كان
    // نفس الحساب يحمل صلاحية super_admin (is_admin = true على حساب مدرس).
    // فقط السوبر أدمن الذي لا يملك teacher_profile_id إطلاقاً يرى بيانات كل المدرسين.
    let watchQuery = db.collection('video_views').where('lastViewedAt', '>=', rangeStart);

    if (teacherId) {
      watchQuery = watchQuery.where('teacherId', '==', teacherId);
    }

    const snapshot = await watchQuery.get();

    // تجميع عدد المشاهدات لكل يوم بتوقيت القاهرة
    const byDate = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const ts = data.lastViewedAt;
      if (!ts || typeof ts.toDate !== 'function') return;

      const dateStr = getCairoDateStr(ts.toDate());
      byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    });

    // بناء مصفوفة الأيام السبعة كاملة (حتى الأيام بدون مشاهدات تظهر كـ 0)
    const chart = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = shiftDateStr(todayCairoStr, -i);
      chart.push({
        name: d === todayCairoStr ? 'اليوم' : getDayNameFromDateStr(d),
        date: d,
        count: byDate[d] || 0,
      });
    }

    const todayWatches = chart[chart.length - 1]?.count || 0;
    const totalWatches7Days = chart.reduce((sum, c) => sum + c.count, 0);

    return res.status(200).json({
      success: true,
      today: todayWatches,
      last7DaysTotal: totalWatches7Days,
      chart,
    });

  } catch (err) {
    console.error('❌ Watch Stats Error:', err.message);
    // ⚠️ لو ظهر خطأ يتعلق بوجود فهرس مركب مطلوب (composite index)، فايربيز نفسه
    // يرسل رابطاً جاهزاً لإنشائه تلقائياً من رسالة الخطأ في اللوجات.
    return res.status(500).json({ success: false, error: 'تعذر جلب إحصائيات المشاهدات' });
  }
}
