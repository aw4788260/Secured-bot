import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const apiName = '[API: check-admin]';
  
  let userId = req.headers['x-user-id'];
  if (!userId) userId = req.query.userId; 

  console.log(`${apiName} 🔍 Checking admin status for User: ${userId}`);

  if (!userId) return res.status(400).json({ message: 'Missing userId' });

  try {
    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    const isAdmin = !!(user && user.is_admin);
    console.log(`${apiName} Result: ${isAdmin}`);
    
    return res.status(200).json({ isAdmin });
  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    return res.status(500).json({ message: err.message });
  }
};
