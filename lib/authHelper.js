// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  if (!userId) return false;

  try {
    let subjectId = null;
    let courseId = null;

    // 1. تحديد المادة (Subject) والكورس (Course)
    if (videoId || pdfId) {
      const targetId = videoId || pdfId;
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
      const { data, error } = await supabase
        .from('exams')
        .select('subject_id, subjects(course_id)')
        .eq('id', examId)
        .single();
        
      if (error || !data) return false;
      subjectId = data.subject_id;
      courseId = data.subjects?.course_id;
    }

    if (!subjectId) return false;

    // 2. التحقق من اشتراك "الكورس الكامل"
    if (courseId) {
      const { data: courseAccess, error: courseError } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle(); // ✅ التعديل هنا: استخدمنا maybeSingle بدلاً من single
      
      // إذا وجدنا اشتراك كورس، نرجع true فوراً
      if (courseAccess) return true;
    }

    // 3. التحقق من اشتراك "المادة المحددة"
    // (وصلنا هنا لأن اشتراك الكورس غير موجود، وهذا طبيعي الآن)
    const { data: subjectAccess, error: subjectError } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle(); // ✅ التعديل هنا أيضاً للأمان

    if (subjectAccess) return true; // ✅ مشترك في المادة

    return false; // ❌ غير مشترك في أي شيء

  } catch (error) {
    console.error("Access Check Error:", error);
    return false;
  }
} 
