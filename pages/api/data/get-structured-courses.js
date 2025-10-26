// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  // سطر فحص جديد: هل الملف يعمل أصلاً؟
  console.log("API Route /api/data/get-structured-courses started.");

  const { userId } = req.query; 

  if (!userId) {
    console.warn("API Error: Missing userId query parameter.");
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    // الخطوة 1: التحقق من اشتراك المستخدم
    console.log(`Step 1: Checking subscription for userId: ${userId}`);
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
      console.log("User has full subscription. Fetching all courses.");
      
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });
      if (coursesError) throw coursesError;
      allCourses = coursesData;

      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, title, course_id')
        .order('id', { ascending: true });
      if (videosError) throw videosError;
      allVideos = videosData;

    } else {
      // --- الحالة 2: صلاحية محددة ---
      console.log("User has limited access. Fetching allowed course IDs.");

      const { data: accessData, error: accessError } = await supabase
        .from('user_course_access')
        .select('course_id')
        .eq('user_id', userId);
      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        console.log("User has no specific course access. Returning empty array.");
        return res.status(200).json([]);
      }
      allowedCourseIds = accessData.map(item => item.course_id);
      console.log(`User has access to course IDs: ${allowedCourseIds.join(', ')}`);

      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', allowedCourseIds)
        .order('title', { ascending: true });
      if (coursesError) throw coursesError;
      allCourses = coursesData;

      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('id, title, course_id')
        .in('course_id', allowedCourseIds)
        .order('id', { ascending: true });
      if (videosError) throw videosError;
      allVideos = videosData;
    }

    // --- خطوة التجميع ---
    console.log("Step 2: Assembling data...");
    const coursesMap = new Map();
    allCourses.forEach(course => {
      coursesMap.set(course.id, {
        ...course,
        videos: [] 
      });
    });

    allVideos.forEach(video => {
      const course = coursesMap.get(video.course_id);
      if (course) {
        course.videos.push({
          id: video.id,
          title: video.title
        });
      }
    });

    const finalData = Array.from(coursesMap.values());
    console.log(`Successfully assembled data for ${finalData.length} courses.`);
    res.status(200).json(finalData);

  } catch (err) {
    // هذا هو اللوج الذي لا يظهر عندك
    console.error("CRITICAL Error in get-structured-courses:", err.message, err.stack);
    res.status(500).json({ message: err.message, details: err.stack });
  }
};
