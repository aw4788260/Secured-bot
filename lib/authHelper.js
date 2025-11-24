// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  if (!userId) return false;

  try {
    let subjectId = null;
    let courseId = null;

    // 1. تحديد المادة (Subject) والكورس (Course) بناءً على المدخلات
    if (videoId || pdfId) {
      const targetId = videoId || pdfId;
      // جلب المادة والكورس من جدول الفيديوهات
      const { data, error } = await supabase
        .from('videos')
        .select(`
          chapters (
            subjects (
              id,
              course_id
            )
          )
        `)
        .eq('id', targetId)
        .single();
      
      if (error || !data) return false;
      subjectId = data.chapters?.subjects?.id;
      courseId = data.chapters?.subjects?.course_id;
    } 
    else if (examId) {
      // جلب المادة من جدول الامتحانات
      const { data, error } = await supabase
        .from('exams')
        .select('subject_id, subjects(course_id)') // subjects relation for course_id
        .eq('id', examId)
        .single();
        
      if (error || !data) return false;
      subjectId = data.subject_id;
      courseId = data.subjects?.course_id;
    }

    if (!subjectId) return false;

    // 2. التحقق من اشتراك "الكورس الكامل"
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .single();
      
      if (courseAccess) return true; // ✅ لديه صلاحية الكورس كامل
    }

    // 3. التحقق من اشتراك "المادة المحددة"
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .single();

    if (subjectAccess) return true; // ✅ لديه صلاحية المادة فقط

    return false; // ❌ ليس لديه أي صلاحية

  } catch (error) {
    console.error("Access Check Error:", error);
    return false;
  }
}
