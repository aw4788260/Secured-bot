// pages/api/data/get-structured-courses.js
import { supabase } from '../../../lib/supabaseClient';

// (الاستعلام لم نعد بحاجة لـ allowed_attempts)
const subjectQuery = `
  id, 
  title,
  sort_order,
  chapters (
    id,
    title,
    sort_order,
    videos ( id, title, sort_order )
  ),
  exams ( 
    id, 
    title, 
    duration_minutes, 
    sort_order,
    requires_student_name
  )
`;

export default async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "Missing userId" });

  try {
    let allowedSubjectIds = new Set();
    let finalSubjectsData = [];

    // --- (الخطوة 1 و 2: جلب المواد بنفس الطريقة) ---
    // (جلب الكورسات الكاملة)
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
    // (جلب المواد المحددة)
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

    // --- [ ✅✅ تعديل: جلب "المحاولة الأولى" فقط ] ---
    const { data: userAttempts, error: attemptError } = await supabase
        .from('user_attempts')
        .select('id, exam_id')
        .eq('user_id', userId)
        .eq('status', 'completed') 
        .order('started_at', { ascending: true }); // (الأقدم أولاً)

    if (attemptError) throw attemptError;

    // (وخريطة لتخزين "أول" محاولة)
    const firstAttemptMap = new Map();
    if (userAttempts) {
        for (const attempt of userAttempts) {
            if (!firstAttemptMap.has(attempt.exam_id)) {
                firstAttemptMap.set(attempt.exam_id, attempt.id);
            }
        }
    }
    // --- [ نهاية التعديل ] ---

    // --- الخطوة 4: [ ✅✅ تعديل بناء البيانات ] ---
    finalSubjectsData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const structuredData = finalSubjectsData.map(subject => ({
      ...subject,
      chapters: subject.chapters
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map(chapter => ({
                          ...chapter,
                          videos: chapter.videos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      })),

      // (تعديل منطق الامتحانات)
      exams: subject.exams
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map(exam => {
                          const firstAttemptId = firstAttemptMap.get(exam.id) || null;
                          return {
                              ...exam,
                              first_attempt_id: firstAttemptId,
                              is_completed: !!firstAttemptId, // (هل أكمله؟ نعم/لا)
                          };
                      })
    }));

    res.status(200).json(structuredData); 

  } catch (err) {
    console.error("CRITICAL Error in get-structured-data:", err.message, err.stack);
    res.status(500).json({ message: err.message, details: err.stack });
  }
};
