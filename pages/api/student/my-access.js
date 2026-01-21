import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس

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
      // 4. جلب الكورسات المشترك بها
      const { data: courses } = await supabase
          .from('user_course_access')
          .select('course_id')
          .eq('user_id', userId);

      // 5. جلب المواد المشترك بها
      const { data: subjects } = await supabase
          .from('user_subject_access')
          .select('subject_id')
          .eq('user_id', userId);

      return res.status(200).json({
          courses: courses ? courses.map(c => c.course_id) : [],
          subjects: subjects ? subjects.map(s => s.subject_id) : []
      });
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
