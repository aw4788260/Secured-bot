import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من الصلاحيات (يجب أن يكون سوبر أدمن)
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { teacher_id, discount_type, discount_value, quantity } = req.body;

  // التحقق من المدخلات
  if (!teacher_id || !discount_type || discount_value === undefined || !quantity) {
    return res.status(400).json({ message: 'جميع الحقول مطلوبة (المدرس، نوع الخصم، القيمة، والكمية)' });
  }

  try {
    const codesToInsert = [];
    
    // توليد أكواد عشوائية فريدة (مثال: MED-X9F2A1)
    for (let i = 0; i < quantity; i++) {
      // توليد 6 أحرف/أرقام عشوائية
      const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `MED-${randomString}`;
      
      codesToInsert.push({
        code: code,
        teacher_id: teacher_id,
        discount_type: discount_type, // 'percentage' أو 'fixed'
        discount_value: discount_value
      });
    }

    // إدراج الأكواد في قاعدة البيانات دفعة واحدة
    const { error } = await supabase
      .from('discount_codes')
      .insert(codesToInsert);

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      message: `تم توليد ${quantity} كود خصم بنجاح`,
      generated_count: quantity
    });

  } catch (error) {
    console.error("Generate Codes Error:", error);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء التوليد: ' + error.message });
  }
}
