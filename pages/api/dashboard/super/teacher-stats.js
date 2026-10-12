// pages/api/dashboard/super/teacher-stats.js
import { supabase } from '../../../../lib/supabaseClient';
import { db } from '../../../../lib/firebaseAdmin';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

// ============================================================
// ⏱️ أدوات توقيت القاهرة (نفس المنطق المستخدم في teacher/stats.js و teacher/watch-stats.js)
// ============================================================
const getEgyptOffset = (utcDateInput) => {
  try {
    // ⚠️ utcDateInput لازم يكون UTC صريح (منتهي بـ Z).
    const date = new Date(utcDateInput);
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

// 📺 مشاهدات هذا المدرس لآخر 7 أيام (Firebase — video_views) بنفس طريقة teacher/watch-stats.js
// (استعلام count لكل يوم — أرخص بكثير من جلب المستندات)
async function getTeacherWatches(teacherId, todayCairoStr) {
  const dayRanges = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const dayStr = shiftDateStr(todayCairoStr, -i);
    const nextDayStr = shiftDateStr(dayStr, 1);
    dayRanges.push({
      dayStr,
      start: new Date(`${dayStr}T00:00:00${getEgyptOffset(`${dayStr}T00:00:00Z`)}`),
      end: new Date(`${nextDayStr}T00:00:00${getEgyptOffset(`${nextDayStr}T00:00:00Z`)}`),
    });
  }

  const snaps = await Promise.all(
    dayRanges.map(({ start, end }) =>
      db.collection('video_views')
        .where('lastViewedAt', '>=', start)
        .where('lastViewedAt', '<', end)
        .where('teacherId', '==', String(teacherId))
        .count()
        .get()
    )
  );

  return dayRanges.map(({ dayStr }, idx) => ({
    date: dayStr,
    watches: snaps[idx].data().count || 0,
  }));
}

// 🟢 الطلاب النشطون لهذا المدرس لآخر 7 أيام (Supabase — daily_teacher_user_stats)
// نحدّث صف اليوم أولاً بنفس الـ RPC الذي تستخدمه لوحة المدرس ثم نقرأ الأيام السبعة.
async function getTeacherActiveUsers(teacherId, todayCairoStr) {
  const { error: rpcError } = await supabase.rpc('update_daily_teacher_user_stats', { teacher_id_arg: teacherId });
  if (rpcError) console.warn('⚠️ update_daily_teacher_user_stats failed:', rpcError.message);

  const { data, error } = await supabase
    .from('daily_teacher_user_stats')
    .select('record_date, active_users_today')
    .eq('teacher_id', teacherId)
    .gte('record_date', shiftDateStr(todayCairoStr, -(DAYS - 1)));
  if (error) throw error;

  const byDate = new Map((data || []).map(r => [r.record_date, r.active_users_today || 0]));
  const out = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const dateStr = shiftDateStr(todayCairoStr, -i);
    out.push({ date: dateStr, users: byDate.get(dateStr) || 0 });
  }
  return out;
}

export default async (req, res) => {
  const adminUser = await requireSuperAdmin(req, res);
  if (adminUser.error) return; // الرد (401/403) أُرسل بالفعل داخل requireSuperAdmin

  if (req.method !== 'GET') return res.status(405).end();

  const { id } = req.query; // معرف المدرس
  if (!id) return res.status(400).json({ error: 'Teacher ID required' });

  try {
    // 1. جلب الكورسات
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', id);

    const courseIds = (courses || []).map(c => c.id);

    // 2. حساب الأرباح (RPC أو Fallback)
    let totalEarnings = 0;
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_teacher_revenue', { teacher_id_arg: id });
    
    if (!rpcError) {
      totalEarnings = rpcData;
    } else {
      // Fallback: الحساب اليدوي
      const { data: manualData } = await supabase
        .from('subscription_requests')
        .select('total_price')
        .eq('teacher_id', id)
        .eq('status', 'approved');
      totalEarnings = manualData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
    }

    // 3. جلب المواد المرتبطة بالكورسات
    let subjectIds = [];
    if (courseIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id')
        .in('course_id', courseIds);
      subjectIds = (subjects || []).map(s => s.id);
    }

    // 4. حساب الطلاب الفريدين (Active Students)
    // نستثني المشرفين والمدرسين، ونستثني الصلاحيات المنتهية.
    // ⚡ استعلام واحد داخل Postgres بدل تنزيل كل صفوف الوصول إلى الذاكرة
    const { data: countsData, error: countsError } = await supabase.rpc('get_teacher_student_counts', {
      p_course_ids: courseIds,
      p_subject_ids: subjectIds
    });
    if (countsError) throw countsError;

    const uniqueStudentsCount = countsData?.total_unique_students || 0;

    // 5. الطلبات المعلقة
    const { count: pendingCount } = await supabase
      .from('subscription_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', id)
      .eq('status', 'pending');

    // 6. 📺 المشاهدات + 🟢 الطلاب النشطون (نفس ما تعرضه صفحة المدرس الرئيسية)
    // كل مصدر معزول بـ try/catch: فشل Firebase أو RPC لا يُسقط باقي إحصائيات المودال.
    const todayCairoStr = getCairoDateStr(new Date());
    const [watchesRes, usersRes] = await Promise.allSettled([
      getTeacherWatches(id, todayCairoStr),
      getTeacherActiveUsers(id, todayCairoStr),
    ]);
    if (watchesRes.status === 'rejected') console.error('❌ Teacher watches error:', watchesRes.reason);
    if (usersRes.status === 'rejected') console.error('❌ Teacher active users error:', usersRes.reason);

    const watchDays = watchesRes.status === 'fulfilled' ? watchesRes.value : null;
    const userDays = usersRes.status === 'fulfilled' ? usersRes.value : null;

    // دمج المصدرين في مصفوفة واحدة بمفتاح التاريخ (null = فشل جلب المصدر)
    const activity_chart = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const dateStr = shiftDateStr(todayCairoStr, -i);
      activity_chart.push({
        date: dateStr,
        name: i === 0 ? 'اليوم' : getDayNameFromDateStr(dateStr),
        watches: watchDays ? (watchDays.find(d => d.date === dateStr)?.watches ?? 0) : 0,
        users: userDays ? (userDays.find(d => d.date === dateStr)?.users ?? 0) : 0,
      });
    }

    return res.status(200).json({
      students_count: uniqueStudentsCount,
      balance: totalEarnings,
      pending_requests: pendingCount || 0,
      courses_count: courses?.length || 0,
      today_watches: watchDays ? activity_chart[DAYS - 1].watches : null,
      last7_watches: watchDays ? activity_chart.reduce((sum, d) => sum + d.watches, 0) : null,
      active_users_today: userDays ? activity_chart[DAYS - 1].users : null,
      activity_chart
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
