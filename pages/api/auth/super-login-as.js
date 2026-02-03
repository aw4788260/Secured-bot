import { supabase } from '../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../lib/dashboardHelper';
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
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id, role, username')
      .eq('username', username) // يمكن التعديل للبحث بـ admin_username إذا لزم الأمر
      .single();

    if (findError || !targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // 3. إنشاء توكن جلسة جديد للمستخدم المستهدف
    // نستخدم توكن جديد لنضمن أن عملية الدخول طازجة، ولا نعتمد على توكن قديم قد يكون منتهياً
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    // 4. تحديث التوكن في قاعدة البيانات
    const { error: updateError } = await supabase
      .from('users')
      .update({ session_token: newSessionToken })
      .eq('id', targetUser.id);

    if (updateError) {
      return res.status(500).json({ error: 'فشل تحديث الجلسة' });
    }

    // 5. ضبط الكوكيز في المتصفح
    // ملاحظة: هذا سيستبدل جلسة الأدمن الحالية بجلسة المدرس في المتصفح
    res.setHeader('Set-Cookie', serialize('admin_session', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // يوم واحد
      path: '/',
    }));

    // 6. تسجيل العملية للأمان (اختياري)
    console.log(`[Security] Super Admin (${adminUser.admin_username}) logged in as (${targetUser.username})`);

    return res.status(200).json({ success: true, message: 'تم الدخول بنجاح' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
