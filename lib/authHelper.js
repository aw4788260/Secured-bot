// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  // 1. التحقق المبدئي من وجود User ID
  if (!userId || userId === 'undefined' || userId === 'null') {
      console.log("❌ [AuthHelper] User ID missing.");
      return false;
  }

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

    // ✅ أولاً: هل يمتلك "الكورس كاملاً"؟
    if (courseId) {
      const { data: courseAccess, error } = await supabase
        .from('user_course_access')
        .select('*') // نختار الكل لتجنب خطأ عدم وجود عمود id
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) {
          console.log(`✅ [AuthHelper] Access Granted: User owns full Course ${courseId}`);
          return true; // 🛑 توقف هنا، ومبروك الدخول!
      } else {
          console.log(`ℹ️ [AuthHelper] No full course access found for Course ${courseId}, checking subject...`);
      }
    }

    // ✅ ثانياً: (فقط إذا لم ينجح الشرط السابق) هل يمتلك "المادة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('*') // نختار الكل
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        console.log(`✅ [AuthHelper] Access Granted: User owns Subject ${subjectId}`);
        return true;
    }

    // ❌ فشل في الاثنين
    console.log(`⛔ [AuthHelper] Access Denied for User ${userId}`);
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] Error:", error);
    return false;
  }
}
