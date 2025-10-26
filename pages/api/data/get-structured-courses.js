// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { userId } = req.query; 

  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    // الخطوة 1: التحقق إذا كان المستخدم له صلاحية كاملة
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', userId)
      .single();
      
    if (userError && userError.code !== 'PGRST116') throw userError;

    
    if (user && user.is_subscribed) {
      // --- الحالة 1: صلاحية كاملة (هذا الجزء سليم ويعمل) ---
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          videos ( id, title )
        `)
        .order('title', { ascending: true })
        .order('id', { foreignTable: 'videos', ascending: true });

      if (error) throw error;
      res.status(200).json(data); // إرسال البيانات مباشرة

    } else {
      // --- الحالة 2: صلاحية محددة (المنطق الجديد والأكثر أماناً) ---
      
      // الخطوة أ: جلب أرقام الكورسات المسموحة فقط
      const { data: accessData, error: accessError } = await supabase
        .from('user_course_access')
        .select('course_id') // جلب أرقام الكورسات فقط
        .eq('user_id', userId);

      if (accessError) throw accessError;

      // إذا لم يكن لديه صلاحية لأي كورس، أرسل مصفوفة فارغة
      if (!accessData || accessData.length === 0) {
        return res.status(200).json([]);
      }

      // تحويل النتيجة إلى مصفوفة من الأرقام [1, 5, 12]
      const allowedCourseIds = accessData.map(item => item.course_id);

      // الخطوة ب: جلب تفاصيل هذه الكورسات المحددة
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          videos ( id, title )
        `)
        .in('id', allowedCourseIds) // استخدام .in() لجلب الكورسات المطابقة
        .order('title', { ascending: true })
        .order('id', { foreignTable: 'videos', ascending: true });
      
      if (coursesError) throw coursesError;

      res.status(200).json(coursesData);
    }

  } catch (err) {
    // إظهار الخطأ الفعلي في سجلات السيرفر (Logs)
    console.error("Error in get-structured-courses:", err.message);
    res.status(500).json({ message: err.message });
  }
};
