import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 2. تفعيل الحماية والتحقق من التوكن
  const isAuthorized = await checkUserAccess(req); 
  
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استخراج المعرف الآمن
  const userId = req.headers['x-user-id'];
  
  // نستخرج فقط البيانات المسموح بتعديلها (تجاهلنا phone و username تماماً)
  const { firstName } = req.body;

  try {
    // ==========================================================
    // ✅ 1. تجهيز البيانات للتحديث (المسموح بها فقط)
    // ==========================================================
    const updates = {};
    
    if (firstName) updates.first_name = firstName;
    
    // 🛑 ملاحظة: تم إزالة أي تحديث لـ phone و username 
    // السيرفر الآن سيتجاهل هذه القيم حتى لو تم إرسالها في الطلب

    // إذا لم يكن هناك أي بيانات مسموح بتحديثها
    if (Object.keys(updates).length === 0) {
        return res.status(200).json({ success: true, message: 'No allowed fields to update' });
    }

    // ==========================================================
    // ✅ 2. تنفيذ التحديث في قاعدة البيانات
    // ==========================================================
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
        throw error;
    }

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: 'Server Error' });
  }
};
