import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie'; // استيراد لقراءة الكوكيز

export default async (req, res) => {
  // 1. التحقق الأمني: قراءة الكوكيز والتحقق من الجلسة
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;

  if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  // 2. التحقق من صحة التوكن وأن المستخدم أدمن في قاعدة البيانات
  const { data: adminUser, error: authError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('session_token', sessionToken)
      .single();

  if (authError || !adminUser || !adminUser.is_admin) {
      return res.status(403).json({ error: 'Access Denied: Invalid token or user is not an admin' });
  }

  // --- إذا نجح التحقق، نستكمل الكود الأصلي ---
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

    // 4. حساب إجمالي الأرباح (للطلبات المقبولة فقط)
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('status', 'approved');

    // جمع المبالغ
    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    res.status(200).json({ 
        requests: pendingCount || 0, 
        users: usersCount || 0, 
        courses: coursesCount || 0,
        earnings: totalEarnings
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
