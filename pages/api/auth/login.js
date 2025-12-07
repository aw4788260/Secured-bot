import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password, deviceId } = req.body;

  if (!username || !password || !deviceId) {
    return res.status(400).json({ success: false, message: 'البيانات ناقصة' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name, is_admin, is_blocked')
      .eq('username', username) 
      .single();

    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    if (user.is_blocked) {
        return res.status(403).json({ success: false, message: 'هذا الحساب محظور.' });
    }

    // --- نظام قفل الجهاز (يطبق على الكل: طلاب وأدمن) ---
    // الغرض: حماية المحتوى التعليمي
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', user.id)
        .maybeSingle();

    if (deviceData) {
        // إذا كان للجهاز بصمة مسجلة، يجب أن تطابق الحالية
        if (deviceData.fingerprint !== deviceId) {
            return res.status(403).json({ success: false, message: '⛔ هذا الحساب مربوط بجهاز آخر. لا يمكن الدخول من هنا.' });
        }
    } else {
        // أول مرة دخول -> ربط الجهاز بالحساب
        await supabase.from('devices').insert({
            user_id: user.id,
            fingerprint: deviceId
        });
    }

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
