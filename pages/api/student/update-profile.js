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
  const { firstName, phone, username } = req.body;

  try {
    // ==========================================================
    // 🛑 1. التحقق من صحة اسم المستخدم (حروف إنجليزية وأرقام فقط)
    // ==========================================================
    if (username) {
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط (بدون مسافات أو رموز)' });
        }
    }

    // ==========================================================
    // 🛑 2. التحقق من تكرار اسم المستخدم (Check Duplicate Username)
    // ==========================================================
    if (username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', userId) // استثناء المستخدم الحالي (في حال لم يغير اسمه)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: 'اسم المستخدم هذا محجوز بالفعل، يرجى اختيار اسم آخر.' });
      }
    }

    // ==========================================================
    // 🛑 3. التحقق من تكرار رقم الهاتف (Check Duplicate Phone) - (الجديد)
    // ==========================================================
    if (phone) {
      const { data: existingPhone } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .neq('id', userId) // استثناء المستخدم الحالي
        .maybeSingle();

      if (existingPhone) {
        return res.status(400).json({ error: 'رقم الهاتف هذا مسجل بالفعل بحساب آخر.' });
      }
    }

    // ==========================================================
    // ✅ 4. تحديث البيانات
    // ==========================================================
    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (phone) updates.phone = phone;
    if (username) updates.username = username;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
        // حماية إضافية: في حال حدث تداخل (Race Condition) ووصلت البيانات للداتابيز
        if (error.code === '23505') {
            if (error.message.includes('phone')) {
                return res.status(400).json({ error: 'رقم الهاتف مستخدم بالفعل.' });
            }
            if (error.message.includes('username')) {
                return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل.' });
            }
            return res.status(400).json({ error: 'بيانات مكررة (هاتف أو اسم مستخدم).' });
        }
        throw error;
    }

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: 'Server Error' });
  }
};
