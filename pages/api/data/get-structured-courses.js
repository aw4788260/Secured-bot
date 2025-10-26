// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { userId } = req.query; 

  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    // الخطوة 1: التحقق من اشتراك المستخدم
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', userId)
      .single();
      
    if (userError && userError.code !== 'PGRST116') throw userError;

    let allowedCourseIds = [];
    let allCourses = [];
    let allVideos = [];

    if (user && user.is_subscribed) {
      // --- الحالة 1: صلاحية كاملة ---
      
      // جلب كل الكورسات
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });
      if (coursesError) throw coursesError;
      allCourses = coursesData;

      // جلب كل الفيديوهات
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, title, course_id')
        .order('id', { ascending: true });
      if (videosError) throw videosError;
      allVideos = videosData;

    } else {
      // --- الحالة 2: صلاحية محددة ---

      // جلب أرقام الكورسات المسموحة فقط
      const { data: accessData, error: accessError } = await supabase
        .from('user_course_access')
        .select('course_id')
        .eq('user_id', userId);
      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        return res.status(200).json([]); // ليس لديه صلاحية لأي كورس
      }
      allowedCourseIds = accessData.map(item => item.course_id);

      // جلب تفاصيل هذه الكورسات
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', allowedCourseIds)
        .order('title', { ascending: true });
      if (coursesError) throw coursesError;
      allCourses = coursesData;

      // جلب فيديوهات هذه الكورسات فقط
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, title, course_id')
        .in('course_id', allowedCourseIds)
        .order('id', { ascending: true });
      if (videosError) throw videosError;
      allVideos = videosData;
    }

    // --- خطوة التجميع (هنا يتم دمج البيانات) ---
    
    // 1. إنشاء خريطة (Map) للكورسات لسهولة الوصول
    const coursesMap = new Map();
    allCourses.forEach(course => {
      coursesMap.set(course.id, {
        ...course,
        videos: [] // إضافة مصفوفة فيديوهات فارغة
      });
    });

    // 2. توزيع الفيديوهات على الكورسات الخاصة بها
    allVideos.forEach(video => {
      const course = coursesMap.get(video.course_id);
      if (course) {
        course.videos.push({
          id: video.id,
          title: video.title
        });
      }
    });

    // 3. تحويل الخريطة إلى مصفوفة وإرسالها
    const finalData = Array.from(coursesMap.values());
    res.status(200).json(finalData);

  } catch (err) {
    // هذا السطر مهم جداً ليظهر لك الخطأ الفعلي في Vercel Logs
    console.error("Error in get-structured-courses:", err.message);
    res.status(500).json({ message: err.message });
  }
};
