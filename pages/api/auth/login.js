import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password, deviceId } = req.body;

  if (!username || !password || !deviceId) {
    return res.status(400).json({ success: false, message: 'البيانات ناقصة' });
  }

  try {
    // 1. البحث عن المستخدم
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name')
      .eq('username', username) 
      .single();

    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور خطأ' });
    }

    // 2. التحقق من ربط الجهاز (Device Lock)
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
        // أول مرة يدخل -> نربط الجهاز به
        await supabase.from('devices').insert({
            user_id: user.id,
            fingerprint: deviceId
        });
    }

    // 3. إرجاع الهوية (ليحفظها التطبيق في الذاكرة)
    return res.status(200).json({
        success: true,
        userId: user.id,
        firstName: user.first_name || username
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
