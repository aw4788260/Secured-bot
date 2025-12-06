import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // [✅] استدعاء الحارس الأمني

const subjectQuery = `
  id, title, sort_order,
  chapters (
    id, title, sort_order,
    videos ( id, title, sort_order, type, storage_path, youtube_video_id ),
    pdfs ( id, title, sort_order )
  ),
  exams ( id, title, duration_minutes, sort_order, requires_student_name )
`;

export default async (req, res) => {
  const apiName = '[API: get-courses]';
  const userId = req.headers['x-user-id'];
  
  console.log(`${apiName} 🚀 Fetching courses for User: ${userId}`);

  // ============================================================
  // 🔒 التحقق الأمني الصارم (Device Fingerprint Check)
  // ============================================================
  // نمرر (req) فقط، ليقوم بفحص: هل بصمة هذا الجهاز تطابق المستخدم؟
  const isAuthorized = await checkUserAccess(req);
  
  if (!isAuthorized) {
      console.warn(`${apiName} ⛔ Access Denied: Device Mismatch or Invalid Source.`);
      return res.status(403).json({ message: "Access Denied: Unauthorized Device" });
  }
  // ============================================================

  if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Missing Headers" });
  }

  try {
    let allowedSubjectIds = new Set();
    let finalSubjectsData = [];

    // أ) الكورسات الكاملة
    console.log(`${apiName} 🔍 Checking Full Course Access...`);
    const { data: courseAccess } = await supabase.from('user_course_access').select('course_id').eq('user_id', userId);
    
    if (courseAccess?.length > 0) {
      const courseIds = courseAccess.map(c => c.course_id);
      
      const { data: subjectsFromCourses } = await supabase
        .from('subjects')
        .select(subjectQuery)
        .in('course_id', courseIds)
        .order('sort_order', { ascending: true })
        .order('sort_order', { foreignTable: 'chapters', ascending: true })
        .order('sort_order', { foreignTable: 'chapters.videos', ascending: true });
        
      subjectsFromCourses?.forEach(subject => {
        allowedSubjectIds.add(subject.id);
        finalSubjectsData.push(subject);
      });
    }

    // ب) المواد المحددة
    console.log(`${apiName} 🔍 Checking Specific Subject Access...`);
    const { data: subjectAccess } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', userId);
    
    if (subjectAccess?.length > 0) {
      const specificSubjectIds = subjectAccess.map(s => s.subject_id).filter(id => !allowedSubjectIds.has(id)); 
      
      if (specificSubjectIds.length > 0) {
        const { data: specificSubjects } = await supabase
          .from('subjects')
          .select(subjectQuery)
          .in('id', specificSubjectIds)
          .order('sort_order', { ascending: true })
          .order('sort_order', { foreignTable: 'chapters', ascending: true })
          .order('sort_order', { foreignTable: 'chapters.videos', ascending: true });
          
        if (specificSubjects) finalSubjectsData.push(...specificSubjects);
      }
    }

    // ج) حالة الامتحانات
    const { data: userAttempts } = await supabase
        .from('user_attempts')
        .select('id, exam_id')
        .eq('user_id', userId)
        .eq('status', 'completed'); 

    const firstAttemptMap = new Map();
    userAttempts?.forEach(attempt => {
        if (!firstAttemptMap.has(attempt.exam_id)) firstAttemptMap.set(attempt.exam_id, attempt.id);
    });

    // د) الترتيب النهائي
    console.log(`${apiName} ⚙️ Structuring Data...`);
    finalSubjectsData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const structuredData = finalSubjectsData.map(subject => ({
      ...subject,
      chapters: subject.chapters
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map(chapter => ({
                          ...chapter,
                          videos: chapter.videos?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) || [],
                          pdfs: chapter.pdfs?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) || []
                      })),
      exams: subject.exams
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map(exam => ({
                          ...exam,
                          first_attempt_id: firstAttemptMap.get(exam.id) || null,
                          is_completed: firstAttemptMap.has(exam.id), 
                      }))
    }));

    console.log(`${apiName} 📤 Sending ${structuredData.length} subjects to client.`);
    res.status(200).json(structuredData); 

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    res.status(500).json({ message: err.message });
  }
};
