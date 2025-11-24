// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  if (!userId || userId === 'undefined' || userId === 'null') return false;

  try {
    let subjectId = null;

    // ---------------------------------------------------------
    // الخطوة 1: الوصول لمعرف المادة (Subject ID)
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
    // الخطوة 2: معرفة الكورس التابع لهذه المادة
    // ---------------------------------------------------------
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id')
      .eq('id', subjectId)
      .maybeSingle();
    
    const courseId = subjectData?.course_id;

    // ---------------------------------------------------------
    // الخطوة 3: التحقق (الأولوية للكورس الكامل)
    // ---------------------------------------------------------

    // أولوية 1: هل يمتلك "الكورس كاملاً"؟
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id') 
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) return true; // ✅ مشترك بالكورس
    }

    // أولوية 2: هل يمتلك "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) return true; // ✅ مشترك بالمادة

    return false; // ❌ غير مشترك

  } catch (error) {
    return false;
  }
}
