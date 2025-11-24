import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  if (!userId || userId === 'undefined' || userId === 'null') return false;

  try {
    let subjectId = null;
    let courseId = null;

    // ---------------------------------------------------------
    // الخطوة 1: جلب معرف المادة والكورس (باستعلام واحد فقط)
    // ---------------------------------------------------------
    
    if (videoId || pdfId) {
      const targetId = videoId || pdfId;
      
      // استعلام متداخل: فيديو -> شابتر -> مادة (يجلب id و course_id)
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
        .maybeSingle();

      // التحقق من صحة البيانات المتداخلة
      if (error || !data || !data.chapters || !data.chapters.subjects) return false;
      
      subjectId = data.chapters.subjects.id;
      courseId = data.chapters.subjects.course_id;

    } else if (examId) {
      // استعلام متداخل: امتحان -> مادة (يجلب course_id)
      const { data, error } = await supabase
        .from('exams')
        .select(`
          subject_id,
          subjects (
            course_id
          )
        `)
        .eq('id', examId)
        .maybeSingle();

      if (error || !data) return false;
      
      subjectId = data.subject_id;
      courseId = data.subjects?.course_id;
    }

    if (!subjectId) return false;

    // ---------------------------------------------------------
    // الخطوة 2: التحقق من الاشتراكات (بأقل عدد استعلامات)
    // ---------------------------------------------------------

    // أولوية 1: هل يمتلك "الكورس كاملاً"؟
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) return true; // ✅ مشترك بالكورس، انتهى التحقق
    }

    // أولوية 2: هل يمتلك "المادة المحددة"؟ (فقط إذا فشل الكورس)
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) return true; // ✅ مشترك بالمادة

    // ❌ فشل في الاثنين
    return false;

  } catch (error) {
    return false;
  }
}
