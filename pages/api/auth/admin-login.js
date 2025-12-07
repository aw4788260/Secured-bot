import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password } = req.body;

  try {
    // 1. البحث عن المستخدم باستخدام "يوزر نيم الأدمن" الجديد
    const { data: user } = await supabase
      .from('users')
      .select('id, admin_password, is_admin, is_blocked')
      .eq('admin_username', username) // ✅ البحث في العمود الجديد
      .single();

    // 2. التحقق من الباسورد (الخاص بالأدمن)
    if (!user || user.admin_password !== password) { // ✅ مقارنة مع العمود الجديد
        return res.status(401).json({ success: false, message: 'بيانات دخول الأدمن غير صحيحة' });
    }

    if (!user.is_admin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية دخول لوحة التحكم.' });
    }

    // 3. توليد وحفظ توكن الجلسة (لفصل الجلسات)
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) throw updateError;

    return res.status(200).json({
        success: true,
        userId: user.id,
        sessionToken: newSessionToken
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
