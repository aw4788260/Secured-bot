import { supabase } from '../../lib/supabaseClient';
import { requireSuperAdmin } from '../../lib/dashboardHelper';
import { serialize } from 'cookie';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. حماية الـ API: التأكد أن الطالب هو Super Admin
  const { user: adminUser, error } = await requireSuperAdmin(req, res);
  if (error) return; // تم إرسال الرد في الدالة المساعدة

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // 2. البحث عن المستخدم المستهدف (المدرس)
    // نستخدم admin_username لأن الدخول يتم للوحة التحكم
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id, role, username, admin_username, session_token')
      .eq('admin_username', username)
      .single();

    if (findError || !targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود أو بيانات الدخول غير متطابقة' });
    }

    // 3. تحديد التوكن المستخدم (للحفاظ على جلسة المدرس)
    let tokenToUse = targetUser.session_token;

    // إذا لم يكن لدى المدرس جلسة نشطة (التوكن فارغ)، ننشئ واحداً جديداً
    if (!tokenToUse) {
      tokenToUse = crypto.randomBytes(32).toString('hex');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: tokenToUse })
        .eq('id', targetUser.id);

      if (updateError) {
        return res.status(500).json({ error: 'فشل إنشاء جلسة جديدة' });
      }
    }

    // 4. ضبط الكوكيز في متصفح السوبر أدمن
    // يتم استخدام نفس التوكن، مما يعني أن المدرس لن يخرج من حسابه إذا كان متصلاً
    res.setHeader('Set-Cookie', serialize('admin_session', tokenToUse, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // يوم واحد
      path: '/',
    }));

    // 5. تسجيل العملية (Logs)
    console.log(`[Security] Super Admin (${adminUser.admin_username}) logged in as Teacher (${targetUser.admin_username}) using shared session.`);

    return res.status(200).json({ success: true, message: 'تم الدخول بنجاح' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
