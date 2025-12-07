import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { userId, deviceId } = req.body;

  if (!userId || !deviceId) {
    return res.status(400).json({ valid: false, message: 'Missing credentials' });
  }

  try {
    // 1. التحقق من أن المستخدم ما زال "أدمن" ولم يتم حظره
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin, is_blocked')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.is_admin || user.is_blocked) {
      return res.status(401).json({ valid: false, message: 'Unauthorized User' });
    }

    // 2. التحقق من تطابق بصمة الجلسة (لضمان أنه آخر جهاز تم الدخول منه)
    const { data: device, error: devError } = await supabase
      .from('devices')
      .select('fingerprint')
      .eq('user_id', userId)
      .single();

    if (devError || !device || device.fingerprint !== deviceId) {
      return res.status(401).json({ valid: false, message: 'Session Expired or Overridden' });
    }

    // الجلسة سليمة
    return res.status(200).json({ valid: true });

  } catch (err) {
    console.error('Session Check Error:', err);
    return res.status(500).json({ valid: false, message: 'Server Error' });
  }
};
