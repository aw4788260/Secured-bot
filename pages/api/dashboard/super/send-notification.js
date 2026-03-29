import { supabase } from '../../../../lib/supabaseClient';
import admin from '../../../../lib/firebaseAdmin';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من أن المرسل هو المدير العام
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return;

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { title, body, targetType, targetId, userIdentifier } = req.body;

  if (!title || !body || !targetType) {
    return res.status(400).json({ success: false, message: 'عنوان ونص الإشعار مطلوبان.' });
  }

  try {
    let finalTargetId = targetId;
    
    // الهيكل الأساسي للرسالة (يدعم أندرويد وآيفون)
    let message = {
      notification: { title, body },
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } } },
      data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: targetType }
    };

    // ==========================================================
    // 🎯 استهداف طالب معين (عبر الهاتف أو اسم المستخدم)
    // ==========================================================
    if (targetType === 'user') {
        if (!userIdentifier) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال هاتف أو اسم مستخدم الطالب.' });
        }

        // البحث عن الطالب وجلب التوكن الخاص بجهازه
        const { data: student, error: stdErr } = await supabase
            .from('users')
            .select('id, fcm_token, first_name')
            .eq('role', 'student')
            .or(`username.eq.${userIdentifier.trim()},phone.eq.${userIdentifier.trim()}`)
            .single();

        if (stdErr || !student) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على طالب بهذا الرقم/الاسم.' });
        }
        if (!student.fcm_token) {
            return res.status(400).json({ success: false, message: `الطالب (${student.first_name}) لم يقم بفتح التطبيق حتى الآن، لا يمكن إرسال إشعار له.` });
        }

        // إرسال الإشعار لجهاز الطالب تحديداً
        message.token = student.fcm_token;
        message.data.id = student.id.toString();
        finalTargetId = student.id;
    } 
    // ==========================================================
    // 📢 استهداف جماعي (الكل، كورس، أو مادة)
    // ==========================================================
    else {
        let topic = 'all_users'; 
        if (targetType === 'course') {
            if(!targetId) return res.status(400).json({ success: false, message: 'يرجى تحديد الكورس.' });
            topic = `course_${targetId}`;
        } else if (targetType === 'subject') {
            if(!targetId) return res.status(400).json({ success: false, message: 'يرجى تحديد المادة.' });
            topic = `subject_${targetId}`;
        }
        
        message.topic = topic;
        if (targetId) message.data.id = targetId.toString();
    }

    // الإرسال الفعلي عبر سيرفرات فايربيز
    const fcmResponse = await admin.messaging().send(message);
    console.log('FCM Success:', fcmResponse);

    // حفظ الإشعار في قاعدة البيانات ليظهر للطالب في "شاشة الإشعارات" داخل التطبيق
    const { error: dbError } = await supabase
      .from('notifications')
      .insert({
        title,
        body,
        target_type: targetType,
        target_id: finalTargetId ? finalTargetId.toString() : null,
        sender_role: 'super_admin'
      });

    if (dbError) throw dbError;

    return res.status(200).json({ 
        success: true, 
        message: targetType === 'user' ? 'تم إرسال الإشعار للطالب بنجاح 🚀' : 'تم إرسال الإشعار الجماعي بنجاح 🚀' 
    });

  } catch (error) {
    console.error('Send Notification Error:', error);
    return res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ أثناء الإرسال', 
        error: error.message 
    });
  }
};
