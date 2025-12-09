import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  // التحقق من الهوية عبر الهيدر فقط
  const userId = req.headers['x-user-id'];

  if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
      // جلب الطلبات الخاصة بهذا المستخدم
      const { data, error } = await supabase
          .from('subscription_requests')
          .select('id, created_at, status, course_title, total_price, rejection_reason')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(data);
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
