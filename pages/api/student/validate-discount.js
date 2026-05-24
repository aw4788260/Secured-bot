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

  // ✅ استقبال الكود والمدرس والسلة (selectedItems)
  const { code, teacher_id, selectedItems } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'كود الخصم مطلوب' });
  }

  try {
    // 2. البحث عن الكود في قاعدة البيانات وجلب بيانات الارتباط الجديدة
    const { data, error } = await supabase
      .from('discount_codes')
      .select('id, code, discount_type, discount_value, expires_at, link_type, teacher_id, course_id, subject_id')
      .eq('code', code.trim().toUpperCase())
      .eq('is_used', false)
      .single();

    if (error || !data) {
      return res.status(400).json({ 
        success: false, 
        message: 'كود الخصم غير صحيح أو تم استخدامه من قبل' 
      });
    }

    // 3. التحقق من تاريخ انتهاء الصلاحية
    if (data.expires_at) {
        const now = new Date();
        const expiryDate = new Date(data.expires_at);
        
        if (now > expiryDate) {
            return res.status(400).json({
                success: false,
                message: 'عذراً، هذا الكوبون منتهي الصلاحية.'
            });
        }
    }

    // ✅ 4. التحقق من تطابق الكوبون مع سلة المشتريات الممررة
    const linkType = data.link_type || 'teacher'; 
    const items = selectedItems || [];
    let isValidForCart = false;

    if (linkType === 'teacher') {
        if (!teacher_id || data.teacher_id != teacher_id) {
            return res.status(400).json({ success: false, message: 'عذراً، هذا الكوبون غير مخصص لهذا المدرس.' });
        }
        isValidForCart = true;
    } 
    else if (linkType === 'course') {
        // التحقق مما إذا كان الكورس المطلوب متاحاً داخل السلة
        isValidForCart = items.some(item => item.type === 'course' && item.id == data.course_id);
        if (!isValidForCart) {
            return res.status(400).json({ success: false, message: 'عذراً، هذا الكوبون غير صالح للاستخدام مع الكورس المحدد.' });
        }
    } 
    else if (linkType === 'subject') {
        // التحقق مما إذا كانت المادة المطلوبة متاحة داخل السلة
        isValidForCart = items.some(item => item.type === 'subject' && item.id == data.subject_id);
        if (!isValidForCart) {
            return res.status(400).json({ success: false, message: 'عذراً، هذا الكوبون غير صالح للاستخدام مع المادة المحددة.' });
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
