import { supabase } from './supabaseClient';
import admin from './firebaseAdmin';

/**
 * إرسال إشعار للطالب بنتيجة طلب الاشتراك (قبول / رفض)
 * يُستخدم من كل الأماكن التي تُغيّر حالة subscription_requests:
 * - لوحة تحكم المدرس (الويب): pages/api/dashboard/teacher/requests.js
 * - لوحة تحكم المدرس (التطبيق): pages/api/teacher/students.js
 * - لوحة السوبر أدمن: pages/api/dashboard/super/requests.js
 *
 * لا يرمي أخطاء للخارج أبداً — فشل الإشعار لا يجب أن يفشل عملية القبول/الرفض نفسها.
 */
export async function notifyStudentSubscriptionDecision({
  userId,
  decision,        // 'approve' | 'reject'
  courseTitle,     // نص وصف العناصر (request.course_title أو ملخص مبسط)
  rejectionReason, // اختياري - سبب الرفض
  requestId,
  senderRole = 'teacher' // 'teacher' | 'super_admin'
}) {
  if (!userId) return;

  try {
    const { data: studentUser } = await supabase
      .from('users')
      .select('id, fcm_token')
      .eq('id', userId)
      .maybeSingle();

    if (!studentUser?.fcm_token) return; // الطالب لم يفتح التطبيق بعد، لا يوجد توكن لإرسال إشعار له

    const isApproved = decision === 'approve';
    const title = isApproved ? '✅ تم قبول طلب اشتراكك' : '❌ تم رفض طلب اشتراكك';
    const body = isApproved
      ? `تم تفعيل اشتراكك بنجاح في: ${courseTitle || 'المحتوى المطلوب'}`
      : `تم رفض طلب اشتراكك${rejectionReason ? ' — ' + rejectionReason : ''}`;

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
        type: 'subscription_decision',
        decision,
        id: requestId ? requestId.toString() : ''
      }
    });

    await supabase.from('notifications').insert({
      title,
      body,
      target_type: 'subscription_decision',
      target_id: requestId ? requestId.toString() : null,
      sender_role: senderRole
    });
  } catch (err) {
    // لا نفشل عملية القبول/الرفض بسبب فشل الإشعار فقط
    console.error('⚠️ FCM Student Decision Notify Error:', err.message);
  }
}
