// pages/api/auth/check-device.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { userId, fingerprint } = req.body;
  if (!userId || !fingerprint) {
    return res.status(400).json({ message: 'Missing userId or fingerprint' });
  }
  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('fingerprint')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!device) {
      await supabase
        .from('devices')
        .insert({ user_id: userId, fingerprint: fingerprint });
      return res.status(200).json({ success: true, message: 'Device registered' });
    }
    if (device.fingerprint === fingerprint) {
      return res.status(200).json({ success: true, message: 'Device verified' });
    }
    return res.status(403).json({ success: false, message: 'تم ربط هذا الحساب بجهاز آخر.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
