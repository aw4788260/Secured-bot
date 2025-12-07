import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { userId, sessionToken } = req.body;

  if (!userId || !sessionToken) {
    return res.status(400).json({ valid: false });
  }

  try {
    // جلب التوكن الحالي من قاعدة البيانات
    const { data: user, error } = await supabase
      .from('users')
      .select('session_token, is_admin')
      .eq('id', userId)
      .single();

    if (error || !user || !user.is_admin) {
      return res.status(401).json({ valid: false });
    }

    // المقارنة: هل التوكن الذي يملكه المتصفح هو نفسه المسجل في القاعدة؟
    // إذا قام الأدمن بتسجيل الدخول من جهاز آخر، سيتغير التوكن في القاعدة، وبالتالي ستفشل هذه المقارنة
    if (user.session_token !== sessionToken) {
      return res.status(401).json({ valid: false, message: 'Session expired (Logged in elsewhere)' });
    }

    return res.status(200).json({ valid: true });

  } catch (err) {
    return res.status(500).json({ valid: false });
  }
};
