import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  // [✅] نستخدم الهيدر، مع دعم الكويري كخيار ثانوي
  let userId = req.headers['x-user-id'];
  if (!userId) userId = req.query.userId; 

  if (!userId) return res.status(400).json({ message: 'Missing userId' });

  try {
    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    return res.status(200).json({ isAdmin: !!(user && user.is_admin) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
