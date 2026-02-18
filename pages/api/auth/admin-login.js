import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import { LRUCache } from 'lru-cache'; 

// إعداد الذاكرة المؤقتة (يتم تخزين البيانات لمدة 15 دقيقة)
const rateLimit = new LRUCache({
  max: 500, 
  ttl: 15 * 60 * 1000, 
});

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 1. استخراج عنوان الـ IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  
  // 2. جلب سجل الـ IP من الذاكرة (أو إنشاء سجل جديد إذا لم يوجد)
  let record = rateLimit.get(ip) || { attempts: 0, blockUntil: 0 };

  // 3. التحقق مما إذا كان المستخدم محظوراً حالياً
  if (record.blockUntil > Date.now()) {
    // حساب الدقائق المتبقية (الفرق بين وقت فك الحظر والوقت الحالي مقسوماً على 60 ألف ملي ثانية)
    // نستخدم Math.ceil لتقريب الوقت للأعلى (مثلاً 14.2 دقيقة ستظهر 15 دقيقة)
    const minutesLeft = Math.ceil((record.blockUntil - Date.now()) / 60000);
    
    return res.status(429).json({ 
        success: false, 
        message: `تم حظر حسابك مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد ${minutesLeft} دقيقة.` 
    });
  }

  const { username, password } = req.body;

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, admin_password, is_admin, role, is_blocked, teacher_profile_id, first_name, admin_username')
      .eq('admin_username', username)
      .single();

    // 4. إذا كان المستخدم غير موجود أو كلمة المرور خاطئة
    if (!user || !(await bcrypt.compare(password, user.admin_password))) {
        record.attempts += 1;
        
        // إذا وصل لـ 5 محاولات فاشلة، نقوم بتحديد وقت انتهاء الحظر (بعد 15 دقيقة من الآن)
        if (record.attempts >= 5) {
            record.blockUntil = Date.now() + (15 * 60 * 1000); // الوقت الحالي + 15 دقيقة
        }
        
        // تحديث السجل في الذاكرة
        rateLimit.set(ip, record);

        // إذا كانت هذه هي المحاولة الخامسة تحديداً، نعرض رسالة الحظر فوراً
        if (record.attempts >= 5) {
            return res.status(429).json({ 
                success: false, 
                message: 'تم حظر حسابك مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد 15 دقيقة.' 
            });
        }

        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // --- (من هنا يبدأ كود النجاح في الدخول) ---

    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    if (!isSuperAdmin && !isTeacher) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بدخول لوحة التحكم.' });
    }

    if (user.is_blocked) {
        return res.status(403).json({ success: false, message: 'هذا الحساب محظور.' });
    }

    // 5. تصفير العداد فوراً عند تسجيل الدخول بنجاح!
    rateLimit.delete(ip);

    const newSessionToken = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) throw updateError;

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
    return res.status(500).json({ success: false, message: 'حدث خطأ داخلي في الخادم' });
  }
};
