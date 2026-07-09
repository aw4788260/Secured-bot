import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import admin from '../../../lib/firebaseAdmin'; // ✅ لإرسال إشعار للمدرس عند وجود تقييم جديد

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 🛡️ التحقق من الأمان عبر authHelper (بدون تمرير resourceId ليكون فحصاً عاماً للتوكن والجهاز)
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) return res.status(401).json({ message: 'Unauthorized access' });

  const { chapter_id, content } = req.body;

  if (!chapter_id || !content) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const { data: newFeedback, error } = await supabase
      .from('chapter_feedback')
      .insert([{ chapter_id, content }])
      .select('id')
      .single();

    if (error) throw error;

    // =========================================================
    // 🔔 إشعار المدرس (صاحب الكورس) بوجود تقييم/ملاحظة جديدة على الفصل
    // العنوان (Head) = اسم الكورس، والنص = اسم المادة + اسم الفصل
    // فشل الإشعار لا يجب أن يفشل عملية إرسال التقييم نفسها
    // =========================================================
    try {
      const { data: chapterData } = await supabase
        .from('chapters')
        .select(`
          title,
          subjects (
            title,
            courses (
              title,
              teacher_id
            )
          )
        `)
        .eq('id', chapter_id)
        .single();

      const chapterTitle = chapterData?.title || '';
      const subjectTitle = chapterData?.subjects?.title || '';
      const courseTitle = chapterData?.subjects?.courses?.title || 'كورس';
      const teacherId = chapterData?.subjects?.courses?.teacher_id;

      if (teacherId) {
        const { data: teacherUser } = await supabase
          .from('users')
          .select('id, fcm_token')
          .eq('teacher_profile_id', teacherId)
          .eq('role', 'teacher')
          .maybeSingle();

        if (teacherUser?.fcm_token) {
          const notifTitle = courseTitle; // 👈 اسم الكورس كعنوان (Head) للإشعار
          const notifBody = `📝 تقييم جديد على فصل "${chapterTitle}" — مادة: ${subjectTitle}`;

          await admin.messaging().send({
            token: teacherUser.fcm_token,
            notification: { title: notifTitle, body: notifBody },
            android: {
              priority: 'high',
              notification: { sound: 'default', priority: 'max', channelId: 'fcm_channel', clickAction: 'FLUTTER_NOTIFICATION_CLICK' }
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } }
            },
            data: {
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              type: 'chapter_feedback',
              chapter_id: chapter_id.toString(),
              id: newFeedback?.id ? newFeedback.id.toString() : ''
            }
          });

          await supabase.from('notifications').insert({
            title: notifTitle,
            body: notifBody,
            target_type: 'chapter_feedback',
            target_id: newFeedback?.id ? newFeedback.id.toString() : chapter_id.toString(),
            sender_role: 'student'
          });
        }
      }
    } catch (notifyErr) {
      console.error('⚠️ FCM Teacher Feedback Notify Error:', notifyErr.message);
    }

    return res.status(200).json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
