import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحية
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // ==========================================================
  // 🟢 طلبات GET: لجلب بيانات المدرسين والأكواد للواجهة الأمامية
  // ==========================================================
  if (req.method === 'GET') {
    try {
      // أ. جلب المدرسين
      const { data: teachers, error: tError } = await supabase
        .from('teachers')
        .select('id, name');
      if (tError) throw tError;

      // ب. جلب أحدث الأكواد
      const { data: codes, error: cError } = await supabase
        .from('discount_codes')
        .select('*, teachers(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (cError) throw cError;

      return res.status(200).json({ teachers: teachers || [], codes: codes || [] });
    } catch (error) {
      console.error("Fetch Data Error:", error);
      return res.status(500).json({ error: 'فشل جلب البيانات' });
    }
  }

  // ==========================================================
  // 🟠 طلبات POST: لتوليد أكواد جديدة
  // ==========================================================
  if (req.method === 'POST') {
    const { teacher_id, discount_type, discount_value, quantity } = req.body;

    if (!teacher_id || !discount_type || discount_value === undefined || !quantity) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    try {
      const codesToInsert = [];
      
      // توليد أكواد عشوائية
      for (let i = 0; i < quantity; i++) {
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `MED-${randomString}`;
        
        codesToInsert.push({
          code: code,
          teacher_id: teacher_id,
          discount_type: discount_type, 
          discount_value: discount_value
        });
      }

      const { error } = await supabase
        .from('discount_codes')
        .insert(codesToInsert);

      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        message: `تم توليد ${quantity} كود خصم بنجاح`,
        generated_count: quantity,
        generated_codes: codesToInsert 
      });

    } catch (error) {
      console.error("Generate Codes Error:", error);
      return res.status(500).json({ success: false, message: 'حدث خطأ أثناء التوليد: ' + error.message });
    }
  }

  // إذا كانت الطريقة غير GET أو POST
  return res.status(405).json({ message: 'Method not allowed' });
}
