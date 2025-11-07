// pages/api/data/get-structured-courses.js
// (سيعيد هذا ال API "المواد" التي يملكها المستخدم)
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
      
      // جلب "كل" المواد التابعة لهذه الكورسات
      const { data: subjectsFromCourses, error: subjectsErr } = await supabase
        .from('subjects')
        .select(subjectQuery)
        .in('course_id', courseIds)
        .order('sort_order', { ascending: true }) // ترتيب المواد
        .order('sort_order', { foreignTable: 'chapters', ascending: true }) // ترتيب الشباتر
        .order('sort_order', { foreignTable: 'chapters.videos', ascending: true }); // ترتيب الفيديوهات

      if (subjectsErr) throw subjectsErr;
      
      subjectsFromCourses.forEach(subject => {
        allowedSubjectIds.add(subject.id); // (لمنع التكرار لاحقاً)
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
        .filter(id => !allowedSubjectIds.has(id)); // (فلترة المواد التي أخذناها بالفعل من الخطوة 1)

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

    // --- الخطوة 3: فلترة وتنظيف وترتيب ---
    
    // (إعادة ترتيب القائمة النهائية بناءً على sort_order الخاص بالمواد)
    finalSubjectsData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // (فلترة الشباتر والفيديوهات الفارغة)
    const filteredData = finalSubjectsData.map(subject => ({
      ...subject,
      chapters: subject.chapters
                      .filter(chapter => chapter.videos.length > 0)
                      // (ترتيب الشباتر)
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map(chapter => ({
                          ...chapter,
                          // (ترتيب الفيديوهات)
                          videos: chapter.videos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      }))
    })).filter(subject => subject.chapters.length > 0); 
    
    console.log(`Successfully assembled data for ${filteredData.length} subjects.`);
    res.status(200).json(filteredData); // (إرجاع قائمة المواد مباشرة)

  } catch (err) {
    console.error("CRITICAL Error in get-structured-data:", err.message, err.stack);
    res.status(500).json({ message: err.message, details: err.stack });
  }
};
