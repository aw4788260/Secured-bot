import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { firstName, username, password, phone } = req.body;

  // 1. التحقق من صحة البيانات
  if (!firstName || !username || !password || !phone) {
    return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  }

  try {
    // 2. التحقق من عدم تكرار اسم المستخدم
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم مسجل بالفعل، اختر اسماً آخر.' });
    }

    // 3. تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. إنشاء الحساب مباشرة في جدول users
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        first_name: firstName,
        username: username,
        password: hashedPassword,
        phone: phone,
        is_admin: false,
        is_blocked: false
        // session_token يظل فارغاً حتى يسجل الدخول
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, message: 'تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.' });

  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ success: false, message: 'حدث خطأ في الخادم: ' + error.message });
  }
};
