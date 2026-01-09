import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { oldPassword, newPassword } = req.body;
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  if (!oldPassword || !newPassword || !userId) {
    return res.status(400).json({ error: 'Missing data' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    // 1. التحقق الأمني
    const { data: device } = await supabase.from('devices').select('fingerprint').eq('user_id', userId).maybeSingle();
    if (!device || device.fingerprint !== deviceId) return res.status(403).json({ error: 'Unauthorized Device' });

    // 2. جلب كلمة المرور الحالية
    const { data: user } = await supabase.from('users').select('password').eq('id', userId).single();

    // 3. التحقق من صحة كلمة المرور القديمة
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    // 4. تشفير وحفظ الجديدة
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
