// pages/api/auth/send-otp.js
import { supabase } from '../../../lib/supabaseClient';
import { requestOtp } from '../../../lib/otpHelper';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
const PHONE_REGEX = /^01[0-9]{9}$/;
const ALLOWED_PURPOSES = ['signup', 'reset_password', 'change_email'];

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  // Same app-secret gate used by the rest of the auth endpoints
  const appSecret = req.headers['x-app-secret'];
  if (appSecret !== process.env.APP_SECRET) {
    return res.status(403).json({ success: false, message: 'غير مصرح لك باستخدام هذا الرابط' });
  }

  let { email, purpose, username, phone } = req.body;
  purpose = ALLOWED_PURPOSES.includes(purpose) ? purpose : 'signup';

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال بريد إلكتروني صحيح' });
  }
  email = email.trim().toLowerCase();

  try {
    if (purpose === 'signup') {
      // 🆕 التحقق من توفر اسم المستخدم ورقم الهاتف *قبل* إرسال الرمز، حتى لا
      //    يتحقق المستخدم من بريده ثم يُرفض عند إنشاء الحساب لسبب لم يكن يعرفه.
      if (!username || !USERNAME_REGEX.test(username)) {
        return res.status(400).json({ success: false, message: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط.' });
      }

      const phoneToCheck = (phone && phone !== 'null' && String(phone).trim() !== '') ? String(phone).trim() : null;
      if (phoneToCheck && !PHONE_REGEX.test(phoneToCheck)) {
        return res.status(400).json({ success: false, message: 'رقم هاتف غير صالح (11 رقم يبدأ بـ 01)' });
      }

      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل بالفعل' });
      }

      const { data: existingUsername } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingUsername) {
        return res.status(400).json({ success: false, message: 'اسم المستخدم مسجل بالفعل، اختر اسماً آخر.' });
      }

      if (phoneToCheck) {
        const { data: existingPhone } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phoneToCheck)
          .maybeSingle();

        if (existingPhone) {
          return res.status(400).json({ success: false, message: 'رقم الهاتف مسجل مسبقاً. حاول تسجيل الدخول.' });
        }
      }
    }

    if (purpose === 'reset_password') {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (!existing) {
        // Don't leak whether the email exists — respond success either way.
        return res.status(200).json({ success: true, message: 'إذا كان البريد مسجلاً، سيصلك رمز التحقق' });
      }
    }

    const result = await requestOtp({ email, purpose });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' });
  } catch (error) {
    console.error('send-otp error:', error);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

