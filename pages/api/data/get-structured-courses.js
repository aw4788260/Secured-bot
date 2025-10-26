// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { userId } = req.query; // سنتلقى هذا من app.js

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

    let query;

    if (user && user.is_subscribed) {
      // --- الحالة 1: صلاحية كاملة ---
      // اجلب كل الكورسات والفيديوهات (نفس الكود القديم)
      query = supabase
        .from('courses')
        .select(`
          id,
          title,
          videos ( id, title )
        `)
        .order('title', { ascending: true })
        .order('id', { foreignTable: 'videos', ascending: true });

    } else {
      // --- الحالة 2: صلاحية محددة ---
      // اجلب الكورسات فقط من جدول الصلاحيات
      query = supabase
        .from('user_course_access') // نبدأ من جدول الصلاحيات
        .select(`
          courses (
            id,
            title,
            videos ( id, title )
          )
        `)
        .eq('user_id', userId)
        .order('title', { foreignTable: 'courses', ascending: true })
        .order('id', { foreignTable: 'courses.videos', ascending: true });
    }
    
    const { data, error } = await query;
    if (error) throw error;

    // تنسيق البيانات:
    // إذا كانت صلاحية كاملة، data تكون [course1, course2]
    // إذا كانت صلاحية محددة، data تكون [{courses: course1}, {courses: course2}]
    // لذلك نوحد المخرجات:
    const finalData = (user && user.is_subscribed) 
      ? data 
      : data.map(item => item.courses);

    res.status(200).json(finalData);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
