import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { teacher_id, discount_type, discount_value, quantity } = req.body;

  if (!teacher_id || !discount_type || discount_value === undefined || !quantity) {
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  }

  try {
    const codesToInsert = [];
    
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
      generated_codes: codesToInsert // ✅ تمت إضافة هذا السطر لإرجاع الأكواد للواجهة
    });

  } catch (error) {
    console.error("Generate Codes Error:", error);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء التوليد: ' + error.message });
  }
}
