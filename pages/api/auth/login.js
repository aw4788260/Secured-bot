import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password, deviceId } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'البيانات ناقصة' });
  }

  try {
    // 1. البحث عن المستخدم
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name, is_admin, is_blocked')
      .eq('username', username) 
      .single();

    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور خطأ' });
    }

    if (user.is_blocked) {
        return res.status(403).json({ success: false, message: 'هذا الحساب محظور.' });
    }

    // 2. معالجة بصمة الجهاز (للجميع: طلاب وأدمن)
    // [✅ تم إزالة استثناء الأدمن لضمان توافق النظام]
    if (deviceId) {
        const { data: deviceData } = await supabase
            .from('devices')
            .select('fingerprint')
            .eq('user_id', user.id)
            .maybeSingle();

        if (deviceData) {
            // إذا كان له جهاز مسجل، هل هو نفس الجهاز الحالي؟
            if (deviceData.fingerprint !== deviceId) {
                return res.status(403).json({ success: false, message: '⛔ هذا الحساب مربوط بجهاز آخر.' });
            }
        } else {
            // تسجيل الجهاز الجديد (لأول مرة)
            await supabase.from('devices').insert({
                user_id: user.id,
                fingerprint: deviceId
            });
        }
    }

    // 3. إرجاع البيانات
    return res.status(200).json({
        success: true,
        userId: user.id,
        firstName: user.first_name || username,
        isAdmin: user.is_admin
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
