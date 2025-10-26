// pages/api/auth/check-subscription.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', userId)
      .single();

    // التعامل مع خطأ في الاستعلام (ما عدا "عدم العثور" فهو ليس خطأ)
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // إذا لم يتم العثور على المستخدم (PGRST116) أو كان اشتراكه false
    if (!user || !user.is_subscribed) {
      return res.status(200).json({ isSubscribed: false });
    }

    // المستخدم موجود ومشترك
    return res.status(200).json({ isSubscribed: true });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
