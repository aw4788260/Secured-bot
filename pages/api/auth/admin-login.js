import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import { LRUCache } from 'lru-cache'; // ✅ 1. استيراد مكتبة الحماية

// ✅ 2. إعداد الذاكرة المؤقتة (خارج الدالة لتبقى محفوظة في ذاكرة الخادم)
// سيتم تتبع أقصى 500 عنوان IP لمنع استهلاك الذاكرة، ومدة الحظر 15 دقيقة
const rateLimit = new LRUCache({
  max: 500, 
  ttl: 15 * 60 * 1000, 
});

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // ✅ 3. استخراج عنوان الـ IP الخاص بالمستخدم (يدعم الخوادم الوكيلة مثل Vercel و Cloudflare)
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  
  // ✅ 4. التحقق من عدد المحاولات السابقة لهذا الـ IP
  const currentAttempts = rateLimit.get(ip) || 0;

  if (currentAttempts >= 5) {
    // إذا تجاوز 5 محاولات، يتم رفض الطلب فوراً للحد من الضغط على قاعدة البيانات
    return res.status(429).json({ 
        success: false, 
        message: 'تم حظر عنوان IP الخاص بك مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد 15 دقيقة.' 
    });
  }

  const { username, password } = req.body;

  try {
    // 1. البحث باستخدام admin_username حصراً
    const { data: user } = await supabase
      .from('users')
      .select('id, admin_password, is_admin, role, is_blocked, teacher_profile_id, first_name, admin_username')
      .eq('admin_username', username)
      .single();

    // إذا لم يوجد مستخدم بهذا الاسم في عمود admin_username
    if (!user) {
        // ✅ تسجيل محاولة فاشلة
        rateLimit.set(ip, currentAttempts + 1);
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 2. التحقق من كلمة المرور (admin_password)
    const isMatch = await bcrypt.compare(password, user.admin_password);

    if (!isMatch) {
        // ✅ تسجيل محاولة فاشلة
        rateLimit.set(ip, currentAttempts + 1);
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 3. التحقق من الصلاحيات (Teacher & Super Admin Only)
    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    if (!isSuperAdmin && !isTeacher) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بدخول لوحة التحكم.' });
    }

    // 4. فحص الحظر
    if (user.is_blocked) {
        return res.status(403).json({ success: false, message: 'هذا الحساب محظور.' });
    }

    // ✅ 5. تصفير العداد عند تسجيل الدخول بنجاح!
    rateLimit.delete(ip);

    // 6. توليد وحفظ توكن الجلسة
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) throw updateError;

    // 7. إعداد الكوكيز
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
    // ✅ إخفاء رسالة الخطأ الأصلية لتجنب تسريب بيانات الخادم للمخترقين
    return res.status(500).json({ success: false, message: 'حدث خطأ داخلي في الخادم' });
  }
};
