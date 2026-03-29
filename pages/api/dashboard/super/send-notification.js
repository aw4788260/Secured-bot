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
    
    // ==========================================================
    // 🛠️ إعداد هيكل الرسالة لضمان الوصول الفوري (High Priority)
    // ==========================================================
    let message = {
      notification: { title, body },
      
      // ✅ إعدادات أندرويد لإختراق وضع توفير الطاقة (Doze Mode)
      android: {
        priority: 'high', // ضروري جداً لوصول الإشعار والهاتف مغلق
        notification: {
          sound: 'default',
          priority: 'max', // أقصى أولوية للعرض على الشاشة
          channelId: 'fcm_channel', // يجب أن يطابق المعرف في كود Flutter
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      
      // ✅ إعدادات آيفون (APNs) لضمان الوصول السريع
      apns: {
        headers: {
          'apns-priority': '10', // أولوية قصوى لنظام iOS
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true, // يسمح للتطبيق بمعالجة البيانات في الخلفية
          },
        },
      },
      
      // البيانات الإضافية للتوجيه داخل التطبيق
      data: { 
        click_action: 'FLUTTER_NOTIFICATION_CLICK', 
        type: targetType,
        title: title,
        body: body
      }
    };

    // ==========================================================
    // 🎯 استهداف مستخدم معين (طالب، مدرس، أو مشرف)
    // ==========================================================
    if (targetType === 'user') {
        if (!userIdentifier) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال هاتف أو اسم المستخدم.' });
        }

        const { data: targetUser, error: userErr } = await supabase
            .from('users')
            .select('id, fcm_token, first_name, role')
            .or(`username.eq.${userIdentifier.trim()},phone.eq.${userIdentifier.trim()}`)
            .single();

        if (userErr || !targetUser) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على مستخدم بهذا الرقم/الاسم.' });
        }

        if (!targetUser.fcm_token) {
            const roleName = targetUser.role === 'teacher' ? 'المدرس' : targetUser.role === 'moderator' ? 'المشرف' : 'الطالب';
            return res.status(400).json({ success: false, message: `${roleName} (${targetUser.first_name}) لم يقم بفتح التطبيق حتى الآن.` });
        }

        // إرسال لتوكن الجهاز مباشرة
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

    // حفظ الإشعار في قاعدة البيانات
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
