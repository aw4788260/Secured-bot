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

  // ✅ استقبال الكورس والمادة بجانب المدرس لدعم كافة أنواع الكوبونات
  const { code, teacher_id, course_id, subject_id } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'كود الخصم مطلوب' });
  }

  try {
    // 2. البحث عن الكود في قاعدة البيانات وجلب بيانات الارتباط الجديدة
    const { data, error } = await supabase
      .from('discount_codes')
      .select('id, code, discount_type, discount_value, expires_at, link_type, teacher_id, course_id, subject_id')
      .eq('code', code.trim().toUpperCase()) // تجاهل المسافات وحالة الأحرف
      .eq('is_used', false)                  // يجب أن يكون غير مستخدم
      .single();

    // إذا لم يجد الكود أو كان هناك خطأ
    if (error || !data) {
      return res.status(400).json({ 
        success: false, 
        message: 'كود الخصم غير صحيح أو تم استخدامه من قبل' 
      });
    }

    // 3. التحقق من تاريخ انتهاء الصلاحية (إذا كان الكوبون محدد بتاريخ)
    if (data.expires_at) {
        const now = new Date();
        const expiryDate = new Date(data.expires_at);
        
        // إذا كان الوقت الحالي أكبر من وقت الانتهاء، نرفض الكوبون
        if (now > expiryDate) {
            return res.status(400).json({
                success: false,
                message: 'عذراً، هذا الكوبون منتهي الصلاحية.'
            });
        }
    }

    // ✅ 4. التحقق من نطاق (الهدف من) الكوبون بناءً على نوع الارتباط
    const linkType = data.link_type || 'teacher'; // توافق رجعي للأكواد القديمة التي لم يكن بها link_type

    if (linkType === 'teacher') {
        // إذا كان الكوبون مرتبط بمدرس، يجب أن يتطابق معرف المدرس الممرر من التطبيق
        if (!teacher_id || data.teacher_id != teacher_id) {
            return res.status(400).json({ success: false, message: 'عذراً، هذا الكوبون غير مخصص لهذا المدرس.' });
        }
    } else if (linkType === 'course') {
        // إذا كان الكوبون مرتبط بكورس معين
        if (!course_id || data.course_id != course_id) {
            return res.status(400).json({ success: false, message: 'عذراً، هذا الكوبون غير صالح للاستخدام مع هذا الكورس.' });
        }
    } else if (linkType === 'subject') {
        // إذا كان الكوبون مرتبط بمادة معينة
        if (!subject_id || data.subject_id != subject_id) {
            return res.status(400).json({ success: false, message: 'عذراً، هذا الكوبون غير صالح للاستخدام مع هذه المادة.' });
        }
    }

    // 5. إرجاع بيانات الخصم للتطبيق لحساب وعرض السعر الجديد
    return res.status(200).json({ 
      success: true, 
      discount: {
          id: data.id,
          code: data.code,
          discount_type: data.discount_type,
          discount_value: data.discount_value
      }
    });

  } catch (error) {
    console.error("Validate Discount Error:", error);
    return res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
}
