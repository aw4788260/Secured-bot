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
    // ✅ 4. التحقق من صحة اسم المستخدم (حروف إنجليزية وأرقام فقط بدون مسافات)
    if (username) {
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط (بدون مسافات أو رموز)' });
        }
    }

    // 5. التحقق من تكرار اسم المستخدم (إذا تم تغييره)
    if (username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', userId) // استثناء المستخدم الحالي
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
    }

    // 6. تحديث البيانات
    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (phone) updates.phone = phone;
    if (username) updates.username = username;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: 'Server Error' });
  }
};
