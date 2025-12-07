import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  try {
    // 1. عدد الطلبات المعلقة
    const { count: pendingCount } = await supabase
      .from('subscription_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 2. عدد الطلاب (غير الأدمن)
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', false);

    // 3. عدد الكورسات
    const { count: coursesCount } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    // إرجاع الأرقام
    res.status(200).json({ 
        requests: pendingCount || 0, 
        users: usersCount || 0, 
        courses: coursesCount || 0 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
