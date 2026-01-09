import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { firstName, phone, username } = req.body;
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  if (!userId || !deviceId) return res.status(400).json({ error: 'Missing headers' });

  try {
    // 1. التحقق الأمني (الجهاز)
    const { data: device } = await supabase.from('devices').select('fingerprint').eq('user_id', userId).maybeSingle();
    if (!device || device.fingerprint !== deviceId) return res.status(403).json({ error: 'Unauthorized Device' });

    // 2. التحقق من تكرار اسم المستخدم (إذا تم تغييره)
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

    // 3. تحديث البيانات
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
