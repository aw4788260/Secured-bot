import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth'; // ✅ التعديل هنا: استخدام verifyTeacher

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  // 🛡️ 1. التحقق من الأمان عبر verifyTeacher واستخراج معرف المدرس
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ message: auth.error });
  
  const teacherId = auth.teacherId;

  // استلام chapter_id ورقم الصفحة page (افتراضياً 1) والحد limit (افتراضياً 10)
  const { chapter_id, page = 1, limit = 10 } = req.query;

  if (!chapter_id) return res.status(400).json({ message: 'Chapter ID is required' });

  try {
    // 🛡️ 2. التحقق من ملكية المدرس للشابتر
    // نقوم بتتبع الشابتر لمعرفة المادة -> ثم الكورس -> ثم المدرس مالك الكورس
    const { data: chapterData, error: chapterError } = await supabase
      .from('chapters')
      .select(`
        id,
        subjects (
          courses (
            teacher_id
          )
        )
      `)
      .eq('id', chapter_id)
      .single();

    if (chapterError || !chapterData) {
      return res.status(404).json({ message: 'هذا الفصل غير موجود' });
    }

    const chapterOwnerId = chapterData.subjects?.courses?.teacher_id;

    if (chapterOwnerId !== teacherId) {
      return res.status(403).json({ message: 'غير مصرح لك بعرض تقييمات هذا الفصل (لا تملكه)' });
    }

    // 3. حساب النطاق (Range) لجلب البيانات
    const from = (page - 1) * limit;
    const to = (page * limit) - 1;

    // 4. جلب التقييمات بأمان
    const { data, error } = await supabase
      .from('chapter_feedback')
      .select('*')
      .eq('chapter_id', chapter_id)
      .order('created_at', { ascending: false })
      .range(from, to); // 👈 تحديد الـ Pagination هنا

    if (error) throw error;

    // معرفة إذا كان هناك بيانات أخرى لطلبها لاحقاً
    const hasMore = data.length === parseInt(limit);

    return res.status(200).json({ success: true, data, hasMore });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
