import { supabase } from '../../../lib/supabaseClient';

// ============================================================
// ⏳ Cron Job: تنظيف صلاحيات الطلاب منتهية الصلاحية (Feature B)
// ============================================================
// يُستدعى دورياً من الـ scheduler الخاص بك (VPS cron / systemd timer...).
// ليس مرتبطاً بـ GitHub Actions — استدعِه مباشرة عبر curl/wget في crontab، مثلاً:
//   */15 * * * * curl -s -X POST https://<domain>/api/cron/expire-student-access \
//                     -H "Authorization: Bearer $CRON_SECRET"
//
// ملاحظة مهمة: هذا الكرون هو "تنظيف دوري" فقط، وليس نقطة التحقق الحقيقية —
// كل الوصول الفعلي يُمنع فوراً وقت الطلب عبر lib/authHelper.js (يتحقق من
// expires_at في كل قراءة). هذا الكرون فقط:
//   - يحذف الصفوف منتهية الصلاحية فعلياً من الجداول (لتبقى التقارير/الإحصائيات دقيقة)
// ============================================================

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 🔒 حماية المسار بـ secret token لمنع الاستدعاء غير المصرح به
  const authHeader = req.headers['authorization'];
  const providedSecret = authHeader?.replace('Bearer ', '') || req.query.secret;

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date().toISOString();

  try {
    const [courseResult, subjectResult] = await Promise.all([
      expireCourseAccess(now),
      expireSubjectAccess(now)
    ]);

    return res.status(200).json({
      success: true,
      expiredCourseAccess: courseResult.count,
      expiredSubjectAccess: subjectResult.count
    });

  } catch (err) {
    console.error('❌ [expire-student-access] Unexpected error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================
// دورة الكورس الكامل (user_course_access)
// ============================================================
async function expireCourseAccess(now) {
  try {
    // نجلب الصفوف المنتهية أولاً (لمعرفة العدد) قبل حذفها
    const { data: expiredRows, error: fetchError } = await supabase
      .from('user_course_access')
      .select('user_id, course_id')
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (fetchError) throw fetchError;
    if (!expiredRows || expiredRows.length === 0) return { count: 0 };

    const { error: deleteError } = await supabase
      .from('user_course_access')
      .delete()
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (deleteError) throw deleteError;

    console.log(`✅ [expire-student-access] Expired ${expiredRows.length} course-access row(s).`);
    return { count: expiredRows.length };
  } catch (e) {
    console.error('⚠️ [expire-student-access] course-access cleanup failed:', e.message);
    return { count: 0 };
  }
}

// ============================================================
// دورة مادة واحدة فقط (user_subject_access)
// ============================================================
async function expireSubjectAccess(now) {
  try {
    const { data: expiredRows, error: fetchError } = await supabase
      .from('user_subject_access')
      .select('user_id, subject_id')
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (fetchError) throw fetchError;
    if (!expiredRows || expiredRows.length === 0) return { count: 0 };

    const { error: deleteError } = await supabase
      .from('user_subject_access')
      .delete()
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (deleteError) throw deleteError;

    console.log(`✅ [expire-student-access] Expired ${expiredRows.length} subject-access row(s).`);
    return { count: expiredRows.length };
  } catch (e) {
    console.error('⚠️ [expire-student-access] subject-access cleanup failed:', e.message);
    return { count: 0 };
  }
}
