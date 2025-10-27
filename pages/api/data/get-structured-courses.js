// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
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

    let finalData = [];

    if (user && user.is_subscribed) {
      // --- [ ✅ تعديل: الحالة 1: صلاحية كاملة ] ---
      console.log("User has full subscription. Fetching all courses with nested videos.");
      
      // استعلام واحد "ذكي" يجلب الكورسات وبداخلها الفيديوهات
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id, 
          title, 
          videos ( id, title )
        `)
        .order('title', { ascending: true })
        .order('id', { foreignTable: 'videos', ascending: true }); // ترتيب الفيديوهات أيضاً

      if (coursesError) throw coursesError;
      finalData = coursesData;

    } else {
      // --- [ ✅ تعديل: الحالة 2: صلاحية محددة ] ---
      console.log("User has limited access. Fetching allowed courses with nested videos.");

      // استعلام واحد "ذكي" يجلب الكورسات المسموحة فقط، وبداخلها الفيديوهات
      const { data: accessData, error: accessError } = await supabase
        .from('user_course_access')
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

      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        console.log("User has no specific course access. Returning empty array.");
        return res.status(200).json([]);
      }
      
      // Supabase سترجع مصفوفة من { courses: { ... } }
      // نحن نحتاج لاستخلاص الكورسات منها
      finalData = accessData.map(item => item.courses).filter(Boolean); // .filter(Boolean) لإزالة أي قيم null
    }

    // --- خطوة التجميع (لم نعد بحاجة إليها) ---
    // قاعدة البيانات قامت بالتجميع بدلاً منا

    console.log(`Successfully assembled data for ${finalData.length} courses.`);
    res.status(200).json(finalData);

  } catch (err) {
    console.error("CRITICAL Error in get-structured-courses:", err.message, err.stack);
    res.status(500).json({ message: err.message, details: err.stack });
  }
};
