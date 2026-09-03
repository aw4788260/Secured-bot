import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس
import { isAccessRowActive } from '../../../lib/accessExpiryHelper'; // ⏳ فحص انتهاء صلاحية الوصول (Feature B)

export default async (req, res) => {
  // 2. التحقق الأمني الشامل
  // في النظام القديم كان يعيد مصفوفة فارغة، الآن يجب أن يكون المستخدم موثقاً لطلب بياناته
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
      // يمكن إرجاع 401، أو إرجاع مصفوفات فارغة حسب تفضيلك، هنا نفضل 401 للأمان
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استخدام المعرف الآمن
  const userId = req.headers['x-user-id'];

  try {
      // 4. جلب الكورسات المشترك بها (⏳ مع تاريخ الانتهاء)
      const { data: coursesRaw } = await supabase
          .from('user_course_access')
          .select('course_id, granted_at, expires_at')
          .eq('user_id', userId);

      // 5. جلب المواد المشترك بها (⏳ مع تاريخ الانتهاء)
      const { data: subjectsRaw } = await supabase
          .from('user_subject_access')
          .select('subject_id, granted_at, expires_at')
          .eq('user_id', userId);

      // ⏳ الوصول المنتهي يُعامل كغير موجود في مصفوفات الأرقام (للتوافق مع
      // التطبيقات الحالية التي تستخدم courses/subjects كقوائم أرقام فقط)،
      // مع إرفاق تفاصيل كل صف (بما فيها المنتهية) في *Detailed لمن يريد
      // عرض تاريخ الانتهاء أو تنبيه "على وشك الانتهاء" في الواجهة.
      const activeCourses = (coursesRaw || []).filter(isAccessRowActive);
      const activeSubjects = (subjectsRaw || []).filter(isAccessRowActive);

      return res.status(200).json({
          courses: activeCourses.map(c => c.course_id),
          subjects: activeSubjects.map(s => s.subject_id),
          coursesDetailed: (coursesRaw || []).map(c => ({
              course_id: c.course_id,
              granted_at: c.granted_at,
              expires_at: c.expires_at,
              active: isAccessRowActive(c)
          })),
          subjectsDetailed: (subjectsRaw || []).map(s => ({
              subject_id: s.subject_id,
              granted_at: s.granted_at,
              expires_at: s.expires_at,
              active: isAccessRowActive(s)
          }))
      });
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
