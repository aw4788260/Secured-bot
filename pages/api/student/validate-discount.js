import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 1. التحقق من أن المستخدم طالب مسجل دخول
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
    return res.status(401).json({ message: 'Unauthorized Access' });
  }

  const { code, teacher_id } = req.body;

  if (!code || !teacher_id) {
    return res.status(400).json({ message: 'الكود ومعرف المدرس مطلوبان' });
  }

  try {
    // 2. البحث عن الكود في قاعدة البيانات والتأكد من شروطه
    const { data, error } = await supabase
      .from('discount_codes')
      .select('id, code, discount_type, discount_value')
      .eq('code', code.trim().toUpperCase()) // تجاهل المسافات وحالة الأحرف
      .eq('teacher_id', teacher_id)          // يجب أن يكون تابعاً لنفس المدرس
      .eq('is_used', false)                  // يجب أن يكون غير مستخدم
      .single();

    // إذا لم يجد الكود أو كان هناك خطأ
    if (error || !data) {
      return res.status(400).json({ 
        success: false, 
        message: 'كود الخصم غير صحيح أو تم استخدامه من قبل' 
      });
    }

    // 3. إرجاع بيانات الخصم للتطبيق لحساب وعرض السعر الجديد
    return res.status(200).json({ 
      success: true, 
      discount: data 
    });

  } catch (error) {
    console.error("Validate Discount Error:", error);
    return res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
}
