import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto'; // لتوليد توكن عشوائي قوي

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password } = req.body;

  try {
    // 1. التحقق من البيانات
    const { data: user } = await supabase
      .from('users')
      .select('id, password, is_admin, is_blocked')
      .eq('username', username)
      .single();

    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 2. التحقق من الصلاحية (أدمن فقط)
    if (!user.is_admin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية دخول لوحة التحكم.' });
    }

    // 3. توليد توكن جلسة جديد (هذا ما سيطرد الجلسة القديمة)
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    // 4. حفظ التوكن في قاعدة البيانات (في جدول Users)
    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) throw updateError;

    return res.status(200).json({
        success: true,
        userId: user.id,
        sessionToken: newSessionToken // نرسل التوكن ليحفظه المتصفح
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
