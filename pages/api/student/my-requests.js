import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس

export default async (req, res) => {
  // 2. التحقق الأمني الشامل
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استخدام المعرف الآمن (المحقون بعد فك التوكن)
  const userId = req.headers['x-user-id'];

  try {
      // جلب الطلبات الخاصة بهذا المستخدم
      const { data, error } = await supabase
          .from('subscription_requests')
          // ✅ تم إضافة user_note هنا ليتم جلبها مع البيانات
          .select('id, created_at, status, course_title, total_price, rejection_reason, user_note')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(data);
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
