import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { action, type, data } = req.body; 
  // action: 'create', 'update', 'delete'
  // type: 'courses', 'subjects', 'chapters', 'videos', 'pdfs' (لاحظ صيغة الجمع لتطابق أسماء الجداول)

  try {
    // --- إضافة عنصر جديد (Create) ---
    if (action === 'create') {
      let insertData = { ...data };
      
      // إذا كان كورس، نربطه بالمعلم تلقائياً لضمان الملكية
      if (type === 'courses') {
        insertData.teacher_id = auth.teacherId;
        insertData.sort_order = 999; // يضاف في النهاية بشكل افتراضي
      } else {
        // لباقي العناصر، يجب التأكد أن الأب (الكورس/المادة) يتبع لهذا المعلم
        // (يمكن إضافة تحقق إضافي هنا للأمان القصوى، لكن سنكتفي بالربط المباشر للتبسيط الآن)
        insertData.sort_order = 999;
      }
      
      const { data: newItem, error } = await supabase
        .from(type)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) ---
    if (action === 'update') {
      const { id, ...updates } = data;
      
      // هنا يجب إضافة شرط أن العنصر يتبع للمعلم (teacher_id) في حالة الكورسات
      // أو يتبع لسلسلة تنتهي للمعلم في حالة العناصر الأخرى
      let query = supabase.from(type).update(updates).eq('id', id);
      
      if (type === 'courses') {
        query = query.eq('teacher_id', auth.teacherId);
      }

      const { error } = await query;

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // --- حذف عنصر (Delete) ---
    if (action === 'delete') {
      const { id } = data;
      
      let query = supabase.from(type).delete().eq('id', id);
      
      // حماية الحذف: التأكد من الملكية للكورسات
      if (type === 'courses') {
        query = query.eq('teacher_id', auth.teacherId);
      }

      const { error } = await query;

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

  } catch (err) {
    console.error("Teacher Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
