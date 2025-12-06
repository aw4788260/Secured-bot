import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Missing username' });

  try {
    // 1. فحص جدول المستخدمين المسجلين
    const { data: userExists, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userExists) {
      return res.status(200).json({ available: false, message: 'اسم المستخدم مسجل بالفعل.' });
    }

    // 2. فحص جدول الطلبات المعلقة (اختياري، لمنع تضارب الطلبات الجديدة)
    const { data: requestExists, error: reqError } = await supabase
      .from('subscription_requests')
      .select('id')
      .eq('user_username', username)
      .eq('status', 'pending') // نفحص فقط الطلبات المعلقة
      .maybeSingle();

    if (requestExists) {
      return res.status(200).json({ available: false, message: 'يوجد طلب اشتراك قيد المراجعة لهذا الاسم.' });
    }

    // الاسم متاح
    return res.status(200).json({ available: true });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
