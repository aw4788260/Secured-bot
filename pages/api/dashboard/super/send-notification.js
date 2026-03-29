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
    // 🎯 استهداف مستخدم معين (طالب، مدرس، أو مشرف)
    // ==========================================================
    if (targetType === 'user') {
        if (!userIdentifier) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال هاتف أو اسم المستخدم.' });
        }

        // ✅ التعديل هنا: إزالة شرط (role = student) ليتم البحث في كافة المستخدمين
        const { data: targetUser, error: userErr } = await supabase
            .from('users')
            .select('id, fcm_token, first_name, role')
            .or(`username.eq.${userIdentifier.trim()},phone.eq.${userIdentifier.trim()}`)
            .single();

        if (userErr || !targetUser) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على مستخدم بهذا الرقم/الاسم.' });
        }

        // التحقق مما إذا كان المستخدم قد فتح التطبيق وتم توليد توكن له
        if (!targetUser.fcm_token) {
            // تحديد المسمى لرسالة الخطأ بناءً على دور المستخدم
            const roleName = targetUser.role === 'teacher' ? 'المدرس' : targetUser.role === 'moderator' ? 'المشرف' : 'الطالب';
            return res.status(400).json({ success: false, message: `${roleName} (${targetUser.first_name}) لم يقم بفتح التطبيق حتى الآن، لا يمكن إرسال إشعار له.` });
        }

        // إرسال الإشعار لجهاز المستخدم تحديداً
        message.token = targetUser.fcm_token;
        message.data.id = targetUser.id.toString();
        finalTargetId = targetUser.id;
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

    // حفظ الإشعار في قاعدة البيانات ليظهر في "شاشة الإشعارات" داخل التطبيق
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
        message: targetType === 'user' ? 'تم إرسال الإشعار للمستخدم بنجاح 🚀' : 'تم إرسال الإشعار الجماعي بنجاح 🚀' 
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
