import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 2. تفعيل الحماية والتحقق من التوكن
  const isAuthorized = await checkUserAccess(req); 
  
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استخراج المعرف الآمن والبيانات المرسلة
  const userId = req.headers['x-user-id'];
  const { firstName, phone, username } = req.body;

  try {
    // ==========================================================
    // 🛑 1. جلب البيانات الحالية للمستخدم من قاعدة البيانات
    // ==========================================================
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('phone, username')
      .eq('id', userId)
      .single();

    if (fetchError || !currentUser) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // ==========================================================
    // 🛑 2. التحقق من محاولة التلاعب (مقارنة القيم)
    // ==========================================================
    // نتحقق مما إذا كانت القيم المرسلة تختلف عن القيم المحفوظة مسبقاً
    const isPhoneChanged = phone && phone !== currentUser.phone;
    const isUsernameChanged = username && username !== currentUser.username;

    if (isPhoneChanged || isUsernameChanged) {
        // إرسال رسالة خطأ صريحة في حال اكتشاف محاولة تعديل
        return res.status(400).json({ 
            error: 'عذراً، غير مصرح لك بتعديل رقم الهاتف أو اسم المستخدم.' 
        });
    }

    // ==========================================================
    // ✅ 3. تجهيز البيانات للتحديث (المسموح بها فقط)
    // ==========================================================
    const updates = {};
    if (firstName) updates.first_name = firstName;

    // إذا لم يكن هناك أي بيانات مسموح بتحديثها
    if (Object.keys(updates).length === 0) {
        return res.status(200).json({ success: true, message: 'No allowed fields to update' });
    }

    // ==========================================================
    // ✅ 4. تنفيذ التحديث في قاعدة البيانات
    // ==========================================================
    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
        throw updateError;
    }

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: 'Server Error' });
  }
};
