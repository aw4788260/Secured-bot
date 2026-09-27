import { supabase } from '../../../lib/supabaseClient';
import jwt from 'jsonwebtoken';
import { verifyAppCheckWithWhitelist } from '../../../lib/appCheckWhitelist'; // 🆕 القائمة البيضاء

// ============================================================
// 🔎 بحث عام في كل كورسات المتجر
// ============================================================
// get-app-init-data.js أصبح يرسل 5 كورسات عشوائية فقط ("مقترح لك") بدل
// كل الكورسات، لذا أصبحت الشاشة الرئيسية تحتاج نقطة نهاية منفصلة تُستدعى
// فقط عند كتابة المستخدم في خانة البحث. يستخدم نفس الـ view ونفس شكل
// الكائن الذي يعتمد عليه CourseModel.fromJson في التطبيق حتى لا يحتاج
// أي تعديل إضافي هناك.
//
// GET ?q=<term>  -> حتى 30 نتيجة تطابق العنوان أو الكود
// GET (بدون q)   -> فارغة (لا داعي لجلب كل شيء بدون كلمة بحث)
// ============================================================

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const authHeader = req.headers['authorization'];
  let softUserIdForWhitelist = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const softDecoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      softUserIdForWhitelist = softDecoded?.userId || null;
    } catch (e) {
      // توكن غير صالح/منتهي - يُتجاهل، الـ Endpoint عام أصلاً
    }
  }

  const appCheckResult = await verifyAppCheckWithWhitelist(req, [softUserIdForWhitelist], 'SearchCourses API');
  if (!appCheckResult.ok) {
    return res.status(appCheckResult.status).json({ message: appCheckResult.message });
  }

  const q = (req.query.q || '').toString().trim();

  if (!q) {
    return res.status(200).json({ success: true, courses: [] });
  }

  try {
    const escaped = q.replace(/[%_]/g, ''); // تبسيط: منع كسر نمط الـ ilike
    // ✅ ilike في Postgres غير حسّاس لحالة الأحرف أصلاً (يدعم البحث بحروف
    // كبيرة/صغيرة تلقائياً)، والبحث يغطي اسم الكورس والكود معاً.
    // 🐛 تم حذف .order('sort_order', ...) لأن هذا الحقل غير موجود في
    // view_course_details (وهو سبب فشل الطلب بالكامل وعودة "لا توجد
    // نتائج" دائماً في التطبيق) — الترتيب أبجدياً باسم الكورس كافٍ هنا.
    const { data: courses, error } = await supabase
      .from('view_course_details')
      .select('*')
      .or(`course_title.ilike.%${escaped}%,code.ilike.%${escaped}%`)
      .order('course_title', { ascending: true })
      .limit(30);

    if (error) throw error;

    return res.status(200).json({ success: true, courses: courses || [] });
  } catch (err) {
    console.error('[SearchCourses API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
