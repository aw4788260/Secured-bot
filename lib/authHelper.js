// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  // التحقق من أن userId موجود وليس نصاً فارغاً أو "undefined"
  if (!userId || userId === 'undefined' || userId === 'null') return false;

  try {
    let subjectId = null;

    // ---------------------------------------------------------
    // الخطوة 1: العثور على subject_id (معرف المادة)
    // ---------------------------------------------------------
    
    if (videoId || pdfId) {
      const targetId = videoId || pdfId;
      
      // أ) جلب chapter_id من الفيديو
      const { data: videoData } = await supabase
        .from('videos')
        .select('chapter_id')
        .eq('id', targetId)
        .maybeSingle();
      
      if (!videoData) return false;

      // ب) جلب subject_id من الشابتر
      const { data: chapterData } = await supabase
        .from('chapters')
        .select('subject_id')
        .eq('id', videoData.chapter_id)
        .maybeSingle();

      if (!chapterData) return false;
      subjectId = chapterData.subject_id;

    } else if (examId) {
      // أ) جلب subject_id مباشرة من الامتحان
      const { data: examData } = await supabase
        .from('exams')
        .select('subject_id')
        .eq('id', examId)
        .maybeSingle();

      if (!examData) return false;
      subjectId = examData.subject_id;
    }

    if (!subjectId) return false;

    // ---------------------------------------------------------
    // الخطوة 2: العثور على course_id (معرف الكورس) من المادة
    // ---------------------------------------------------------
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id')
      .eq('id', subjectId)
      .maybeSingle();
    
    const courseId = subjectData?.course_id;

    // ---------------------------------------------------------
    // الخطوة 3: التحقق من الاشتراكات (الآن معنا IDs مؤكدة)
    // ---------------------------------------------------------

    // أولاً: هل المستخدم مشترك في "الكورس الكامل"؟
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) return true; // ✅ نعم، مشترك بالكورس
    }

    // ثانياً: هل المستخدم مشترك في "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) return true; // ✅ نعم، مشترك بالمادة

    // ❌ لا يوجد أي اشتراك
    return false;

  } catch (error) {
    console.error("Auth Helper Error:", error);
    return false;
  }
}
