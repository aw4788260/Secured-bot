// pages/api/data/get-structured-courses.js
// (سيعيد هذا ال API "المواد" التي يملكها المستخدم مع الإصلاح)
import { supabase } from '../../../lib/supabaseClient';

// الاستعلام المتداخل لجلب المادة وكل ما تحتها
const subjectQuery = `
  id, 
  title,
  sort_order,
  chapters (
    id,
    title,
    sort_order,
    videos ( id, title, sort_order )
  )
`;

export default async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "Missing userId" });

  try {
    let allowedSubjectIds = new Set();
    let finalSubjectsData = [];

    // --- الخطوة 1: جلب المواد من "الكورسات الكاملة" ---
    const { data: courseAccess, error: courseErr } = await supabase
      .from('user_course_access')
      .select('course_id')
      .eq('user_id', userId);
    
    if (courseErr) throw courseErr;

    if (courseAccess && courseAccess.length > 0) {
      const courseIds = courseAccess.map(c => c.course_id);
      
      const { data: subjectsFromCourses, error: subjectsErr } = await supabase
        .from('subjects')
        .select(subjectQuery)
        .in('course_id', courseIds)
        .order('sort_order', { ascending: true })
        .order('sort_order', { foreignTable: 'chapters', ascending: true })
        .order('sort_order', { foreignTable: 'chapters.videos', ascending: true });

      if (subjectsErr) throw subjectsErr;
      
      subjectsFromCourses.forEach(subject => {
        allowedSubjectIds.add(subject.id);
        finalSubjectsData.push(subject);
      });
    }

    // --- الخطوة 2: جلب "المواد المحددة" ---
    const { data: subjectAccess, error: subjectErr } = await supabase
      .from('user_subject_access')
      .select('subject_id')
      .eq('user_id', userId);

    if (subjectErr) throw subjectErr;

    if (subjectAccess && subjectAccess.length > 0) {
      const specificSubjectIds = subjectAccess
        .map(s => s.subject_id)
        .filter(id => !allowedSubjectIds.has(id)); 

      if (specificSubjectIds.length > 0) {
        const { data: specificSubjects, error: specificErr } = await supabase
          .from('subjects')
          .select(subjectQuery)
          .in('id', specificSubjectIds)
          .order('sort_order', { ascending: true })
          .order('sort_order', { foreignTable: 'chapters', ascending: true })
          .order('sort_order', { foreignTable: 'chapters.videos', ascending: true });

        if (specificErr) throw specificErr;
        finalSubjectsData.push(...specificSubjects);
      }
    }

    // --- الخطوة 3: [ ✅✅ الإصلاح هنا ] ---
    
    // (فقط نقوم بترتيب المواد)
    finalSubjectsData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // (سنقوم فقط بضمان الترتيب الداخلي، وسيتولى التطبيق (app.js)
    // عرض رسائل "لا توجد شباتر" أو "لا توجد فيديوهات" إذا كانت القوائم فارغة)
    
    const structuredData = finalSubjectsData.map(subject => ({
      ...subject,
      // (نرتب الشباتر)
      chapters: subject.chapters
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map(chapter => ({
                          ...chapter,
                          // (ونرتب الفيديوهات)
                          videos: chapter.videos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      }))
    }));
    
    // (ملاحظة: لقد أزلنا الفلترة (.filter) التي كانت تخفي المواد الفارغة)
    
    console.log(`Successfully assembled data for ${structuredData.length} subjects (pre-filtering removed).`);
    res.status(200).json(structuredData); // (إرجاع البيانات كاملة)

  } catch (err) {
    console.error("CRITICAL Error in get-structured-data:", err.message, err.stack);
    res.status(500).json({ message: err.message, details: err.stack });
  }
};
