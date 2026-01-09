import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // استقبال الهيدرز من التطبيق
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  let userData = null;
  let userAccess = { courses: [], subjects: [] };
  let isLoggedIn = false;

  try {
    // 1. التحقق من هوية المستخدم (إذا وجدت بيانات)
    if (userId && deviceId) {
      const { data: deviceCheck } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

      // التحقق من تطابق بصمة الجهاز
      if (deviceCheck && deviceCheck.fingerprint === deviceId) {
        const { data: user } = await supabase
          .from('users')
          .select('id, first_name, username, is_blocked')
          .eq('id', userId)
          .single();

        if (user && !user.is_blocked) {
          userData = user;
          isLoggedIn = true;

          // جلب الاشتراكات
          const { data: courseSubs } = await supabase.from('user_course_access').select('course_id').eq('user_id', userId);
          const { data: subjectSubs } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', userId);

          userAccess = {
            courses: courseSubs ? courseSubs.map(c => c.course_id.toString()) : [],
            subjects: subjectSubs ? subjectSubs.map(s => s.subject_id.toString()) : []
          };
        }
      }
    }

    // 2. جلب قائمة الكورسات العامة (Metadata فقط) من الـ View
    const { data: courses, error } = await supabase
      .from('view_course_details')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // 3. الرد النهائي
    return res.status(200).json({
      success: true,
      isLoggedIn: isLoggedIn,
      user: userData,       // بيانات الطالب (للهيدر والبروفايل)
      myAccess: userAccess, // قائمة الممتلكات (للفلترة)
      courses: courses || [] // قائمة الكورسات (للبحث والعرض)
    });

  } catch (err) {
    console.error('[Init API Error]:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
