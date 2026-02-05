import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password } = req.body;

  try {
    // 1. البحث باستخدام admin_username حصراً
    // كما طلبت: الاعتماد فقط على بيانات الأدمن
    const { data: user } = await supabase
      .from('users')
      .select('id, admin_password, is_admin, role, is_blocked, teacher_profile_id, first_name, admin_username')
      .eq('admin_username', username)
      .single();

    // إذا لم يوجد مستخدم بهذا الاسم في عمود admin_username
    if (!user) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 2. التحقق من كلمة المرور (admin_password)
    const isMatch = await bcrypt.compare(password, user.admin_password);

    if (!isMatch) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 3. التحقق من الصلاحيات (Teacher & Super Admin Only)
    // نسمح بالدخول إذا كان admin=true أو role='super_admin' أو role='teacher'
    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    if (!isSuperAdmin && !isTeacher) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بدخول لوحة التحكم.' });
    }

    // 4. فحص الحظر
    if (user.is_blocked) {
        return res.status(403).json({ success: false, message: 'هذا الحساب محظور.' });
    }

    // 5. توليد وحفظ توكن الجلسة
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) throw updateError;

    // 6. إعداد الكوكيز
    const cookie = serialize('admin_session', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 ساعة
      path: '/'
    });

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
        success: true,
        userId: user.id,
        role: isSuperAdmin ? 'super_admin' : 'teacher',
        name: user.first_name || user.admin_username
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
