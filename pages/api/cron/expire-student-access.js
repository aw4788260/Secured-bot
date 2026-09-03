import { supabase } from '../../../lib/supabaseClient';
import admin from '../../../lib/firebaseAdmin';

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
//   - يُرسل إشعار "انتهت صلاحية اشتراكك" للطالب حتى يجدد
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
      expiredSubjectAccess: subjectResult.count,
      notified: courseResult.notified + subjectResult.notified
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
    // نجلب الصفوف المنتهية أولاً (مع بيانات كافية للإشعار) قبل حذفها
    const { data: expiredRows, error: fetchError } = await supabase
      .from('user_course_access')
      .select('user_id, course_id, courses ( title )')
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (fetchError) throw fetchError;
    if (!expiredRows || expiredRows.length === 0) return { count: 0, notified: 0 };

    const { error: deleteError } = await supabase
      .from('user_course_access')
      .delete()
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (deleteError) throw deleteError;

    let notified = 0;
    for (const row of expiredRows) {
      const ok = await notifyStudentAccessExpired(row.user_id, row.courses?.title);
      if (ok) notified++;
    }

    console.log(`✅ [expire-student-access] Expired ${expiredRows.length} course-access row(s).`);
    return { count: expiredRows.length, notified };
  } catch (e) {
    console.error('⚠️ [expire-student-access] course-access cleanup failed:', e.message);
    return { count: 0, notified: 0 };
  }
}

// ============================================================
// دورة مادة واحدة فقط (user_subject_access)
// ============================================================
async function expireSubjectAccess(now) {
  try {
    const { data: expiredRows, error: fetchError } = await supabase
      .from('user_subject_access')
      .select('user_id, subject_id, subjects ( title )')
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (fetchError) throw fetchError;
    if (!expiredRows || expiredRows.length === 0) return { count: 0, notified: 0 };

    const { error: deleteError } = await supabase
      .from('user_subject_access')
      .delete()
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (deleteError) throw deleteError;

    let notified = 0;
    for (const row of expiredRows) {
      const ok = await notifyStudentAccessExpired(row.user_id, row.subjects?.title);
      if (ok) notified++;
    }

    console.log(`✅ [expire-student-access] Expired ${expiredRows.length} subject-access row(s).`);
    return { count: expiredRows.length, notified };
  } catch (e) {
    console.error('⚠️ [expire-student-access] subject-access cleanup failed:', e.message);
    return { count: 0, notified: 0 };
  }
}

// 🔔 إشعار بسيط للطالب أن صلاحيته انتهت (best-effort، لا يرمي أخطاء للخارج)
async function notifyStudentAccessExpired(userId, itemTitle) {
  if (!userId) return false;

  try {
    const { data: studentUser } = await supabase
      .from('users')
      .select('id, fcm_token')
      .eq('id', userId)
      .maybeSingle();

    const title = '⏳ انتهت صلاحية اشتراكك';
    const body = `انتهت مدة وصولك إلى "${itemTitle || 'أحد المحتويات'}". جدّد اشتراكك للاستمرار في الوصول.`;

    await supabase.from('notifications').insert({
      title,
      body,
      target_type: 'access_expired',
      target_id: userId ? userId.toString() : null,
      sender_role: 'super_admin'
    });

    if (!studentUser?.fcm_token) return false; // الطالب لم يفتح التطبيق بعد، لا يوجد توكن

    await admin.messaging().send({
      token: studentUser.fcm_token,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'max',
          channelId: 'fcm_channel',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } }
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: 'access_expired'
      }
    });
    return true;
  } catch (err) {
    console.error('⚠️ [expire-student-access] FCM student notify error:', err.message);
    return false;
  }
}
