import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password, deviceId } = req.body;

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name, is_admin, is_blocked')
      .eq('username', username) 
      .single();

    if (!user) return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });

    // التحقق من الباسورد المشفر
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });

    if (user.is_blocked) return res.status(403).json({ success: false, message: 'محظور' });

    // نظام قفل الجهاز (كما هو)
    if (deviceId) {
        const { data: deviceData } = await supabase
            .from('devices')
            .select('fingerprint')
            .eq('user_id', user.id)
            .maybeSingle();

        if (deviceData && deviceData.fingerprint !== deviceId) {
            return res.status(403).json({ success: false, message: 'الجهاز غير مطابق' });
        } else if (!deviceData) {
            await supabase.from('devices').insert({ user_id: user.id, fingerprint: deviceId });
        }
    }

    return res.status(200).json({
        success: true,
        userId: user.id,
        firstName: user.first_name,
        isAdmin: user.is_admin
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
