// pages/api/auth/check-admin.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Handle non-404 errors

    if (user && user.is_admin) {
      // (نعم، هو أدمن)
      return res.status(200).json({ isAdmin: true });
    } else {
      // (لا، ليس أدمن)
      return res.status(200).json({ isAdmin: false });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
