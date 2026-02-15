import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // ==========================================================
  // 🟢 GET: جلب البيانات مع الفلترة والتصفح (Pagination)
  // ==========================================================
  if (req.method === 'GET') {
    const { page = 1, limit = 50, teacherId, type, value, isUsed } = req.query;

    try {
      // 1. جلب قائمة المدرسين (للفلاتر والفورم)
      const { data: teachers } = await supabase.from('teachers').select('id, name');

      // 2. بناء استعلام الكوبونات
      let query = supabase
        .from('discount_codes')
        .select('*, teachers(name)', { count: 'exact' });

      // تطبيق الفلاتر إن وجدت
      if (teacherId && teacherId !== 'all') query = query.eq('teacher_id', teacherId);
      if (type && type !== 'all') query = query.eq('discount_type', type);
      if (value) query = query.eq('discount_value', parseFloat(value));
      if (isUsed !== undefined && isUsed !== 'all') query = query.eq('is_used', isUsed === 'true');

      // حساب صفحات العرض (Pagination)
      const from = (page - 1) * parseInt(limit);
      const to = from + parseInt(limit) - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data: codes, count, error: cError } = await query;
      if (cError) throw cError;

      return res.status(200).json({ 
        teachers: teachers || [], 
        codes: codes || [], 
        total: count || 0 
      });
    } catch (error) {
      console.error("Fetch Data Error:", error);
      return res.status(500).json({ error: 'فشل جلب البيانات' });
    }
  }

  // ==========================================================
  // 🟠 POST: توليد أو إدارة الكوبونات
  // ==========================================================
  if (req.method === 'POST') {
    const { action } = req.body;

    try {
      // --- أ. توليد أكواد جديدة ---
      if (action === 'generate') {
        const { teacher_id, discount_type, discount_value, quantity } = req.body;
        if (!teacher_id || !discount_type || discount_value === undefined || !quantity) {
          return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
        }

        const codesToInsert = [];
        for (let i = 0; i < quantity; i++) {
          const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
          codesToInsert.push({
            code: `MED-${randomString}`,
            teacher_id: teacher_id,
            discount_type: discount_type, 
            discount_value: discount_value
          });
        }

        const { error } = await supabase.from('discount_codes').insert(codesToInsert);
        if (error) throw error;

        return res.status(200).json({ 
          success: true, 
          message: `تم توليد ${quantity} كود خصم بنجاح`,
          generated_codes: codesToInsert 
        });
      }

      // --- ب. تغيير حالة الكوبونات (مستخدم / غير مستخدم) ---
      if (action === 'update_status') {
        const { ids, is_used } = req.body;
        const { error } = await supabase
            .from('discount_codes')
            .update({ is_used })
            .in('id', ids);
        
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تم تحديث حالة الكوبونات بنجاح' });
      }

      // --- ج. حذف كوبونات ---
      if (action === 'delete') {
        const { ids } = req.body;
        const { error } = await supabase
            .from('discount_codes')
            .delete()
            .in('id', ids);
            
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تم حذف الكوبونات المحددة نهائياً' });
      }

      return res.status(400).json({ message: 'إجراء غير معروف' });

    } catch (error) {
      console.error("Action Error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
