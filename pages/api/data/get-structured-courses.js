// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  console.log("API Route /api/data/get-structured-courses started.");

  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    // 1. التحقق من اشتراك المستخدم
    console.log(`Step 1: Checking subscription for userId: ${userId}`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', userId)
      .single();
      
    if (userError && userError.code !== 'PGRST116') throw userError;

    let finalData = [];
    const baseQuery = `
      id, 
      title,
      sections (
        id,
        title,
        videos ( id, title )
      )
    `;

    if (user && user.is_subscribed) {
      // --- [ ✅ الحالة 1: صلاحية كاملة - جلب الهيكل الجديد ] ---
      console.log("User has full subscription. Fetching all courses with new structure.");
      
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(baseQuery)
        .order('title', { ascending: true }) // ترتيب الكورسات
        .order('id', { foreignTable: 'sections', ascending: true }) // ترتيب المجلدات
        .order('id', { foreignTable: 'sections.videos', ascending: true }); // ترتيب الفيديوهات

      if (coursesError) throw coursesError;
      finalData = coursesData;

    } else {
      // --- [ ✅ الحالة 2: صلاحية محددة - جلب الهيكل الجديد ] ---
      console.log("User has limited access. Fetching allowed courses with new structure.");

      const { data: accessData, error: accessError } = await supabase
        .from('user_course_access')
        .select(`
          courses ( ${baseQuery} )
        `)
        .eq('user_id', userId)
        .order('title', { foreignTable: 'courses', ascending: true })
        .order('id', { foreignTable: 'courses.sections', ascending: true })
        .order('id', { foreignTable: 'courses.sections.videos', ascending: true });

      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        console.log("User has no specific course access. Returning empty array.");
        return res.status(200).json([]);
      }
      
      finalData = accessData.map(item => item.courses).filter(Boolean);
    }
    
    // --- [ ✅ تحسين: فلترة الأقسام الفارغة ] ---
    // (لضمان عدم ظهور مجلدات فارغة إذا لم تكن الفيديوهات جاهزة)
    const filteredData = finalData.map(course => ({
      ...course,
      sections: course.sections.filter(section => section.videos.length > 0)
    })).filter(course => course.sections.length > 0); // إخفاء الكورسات التي لا تحتوي مجلدات بها فيديوهات
    

    console.log(`Successfully assembled data for ${filteredData.length} courses.`);
    res.status(200).json(filteredData);

  } catch (err) {
    console.error("CRITICAL Error in get-structured-courses:", err.message, err.stack);
    res.status(500).json({ message: err.message, details: err.stack });
  }
};
