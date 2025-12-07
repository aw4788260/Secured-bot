import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password } = req.body;

  try {
    // 1. جلب بيانات الأدمن (لاحظ أننا نجلب الهاش admin_password)
    const { data: user } = await supabase
      .from('users')
      .select('id, admin_password, is_admin, is_blocked')
      .eq('admin_username', username)
      .single();

    if (!user) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 2. مقارنة كلمة المرور المدخلة مع الهاش المحفوظ
    const isMatch = await bcrypt.compare(password, user.admin_password);

    if (!isMatch) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    if (!user.is_admin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية.' });
    }

    // 3. توليد توكن الجلسة
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    // 4. حفظ التوكن في القاعدة (لإبطال أي جلسة سابقة)
    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) throw updateError;

    // 5. إعداد الكوكي الآمن (HttpOnly)
    const cookie = serialize('admin_session', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development', // يعمل HTTPS فقط في الإنتاج
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // يوم واحد
      path: '/'
    });

    // إرسال الكوكي في الهيدر
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
        success: true,
        userId: user.id
        // لاحظ: لا نرسل التوكن في الـ Body للأمان
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
