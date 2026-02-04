import { supabase } from '../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../lib/dashboardHelper';
import { serialize } from 'cookie';
// لم نعد بحاجة لـ crypto لتوليد توكن جديد

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. حماية الـ API: التأكد أن الطالب هو Super Admin
  const { user: adminUser, error } = await requireSuperAdmin(req, res);
  if (error) return; 

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // 2. البحث عن المدرس وجلب التوكن الحالي (session_token)
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id, role, username, admin_username, session_token') // ✅ جلبنا التوكن الحالي
      .eq('admin_username', username)
      .single();

    if (findError || !targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود أو بيانات الدخول غير متطابقة' });
    }

    // ✅ التحقق: هل يوجد توكن أصلاً؟
    // إذا لم يكن المدرس قد سجل دخولاً من قبل، لن يكون لديه توكن.
    // في هذه الحالة فقط نضطر لتوليد واحد جديد، لكن هذا لن يضر لأنه أصلاً غير متصل.
    let tokenToUse = targetUser.session_token;

    if (!tokenToUse) {
        // توليد توكن جديد فقط إذا كان الحقل فارغاً
        const crypto = require('crypto');
        tokenToUse = crypto.randomBytes(32).toString('hex');
        
        await supabase
          .from('users')
          .update({ session_token: tokenToUse })
          .eq('id', targetUser.id);
    }

    // 3. ضبط الكوكيز في متصفح السوبر أدمن باستخدام التوكن الحالي للمدرس
    // هذا لن يؤثر على جلسة المدرس الأصلية
    res.setHeader('Set-Cookie', serialize('admin_session', tokenToUse, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // يوم واحد
      path: '/',
    }));

    console.log(`[Security] Super Admin logged in as Teacher (Shared Session): ${targetUser.admin_username}`);

    return res.status(200).json({ success: true, message: 'تم الدخول بنجاح' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
