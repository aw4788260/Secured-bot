import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 2. التحقق الأمني الشامل (توكن + جهاز + قاعدة بيانات)
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استلام البيانات
  const { oldPassword, newPassword } = req.body;
  // استخدام المعرف الآمن المحقون بواسطة authHelper
  const userId = req.headers['x-user-id'];

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing data' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    // 4. جلب كلمة المرور الحالية للمستخدم الآمن
    const { data: user } = await supabase.from('users').select('password').eq('id', userId).single();

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // 5. التحقق من صحة كلمة المرور القديمة
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    // 6. تشفير وحفظ كلمة المرور الجديدة
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, message: 'Password changed successfully' });

  } catch (err) {
    console.error("Change Password Error:", err);
    return res.status(500).json({ error: 'Server Error' });
  }
};
