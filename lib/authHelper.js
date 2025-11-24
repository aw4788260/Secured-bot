// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null) {
  console.log(`🔍 [AuthHelper] Starting Check: User=${userId}, Video=${videoId}, PDF=${pdfId}, Exam=${examId}`);

  // التحقق من أن userId موجود وليس نصاً فارغاً أو "undefined"
  if (!userId || userId === 'undefined' || userId === 'null') {
      console.log("❌ [AuthHelper] Failed: userId is invalid/missing.");
      return false;
  }

  try {
    let subjectId = null;

    // ---------------------------------------------------------
    // الخطوة 1: العثور على subject_id (معرف المادة)
    // ---------------------------------------------------------
    
    if (videoId || pdfId) {
      const targetId = videoId || pdfId;
      
      // أ) جلب chapter_id من الفيديو
      const { data: videoData, error: vErr } = await supabase
        .from('videos')
        .select('chapter_id')
        .eq('id', targetId)
        .maybeSingle();
      
      if (vErr) console.error("⚠️ [AuthHelper] Video Fetch Error:", vErr.message);
      if (!videoData) {
          console.log(`❌ [AuthHelper] Video/PDF ID ${targetId} not found in DB.`);
          return false;
      }

      // ب) جلب subject_id من الشابتر
      const { data: chapterData, error: cErr } = await supabase
        .from('chapters')
        .select('subject_id')
        .eq('id', videoData.chapter_id)
        .maybeSingle();

      if (cErr) console.error("⚠️ [AuthHelper] Chapter Fetch Error:", cErr.message);
      if (!chapterData) {
          console.log(`❌ [AuthHelper] Chapter ${videoData.chapter_id} not found.`);
          return false;
      }
      subjectId = chapterData.subject_id;

    } else if (examId) {
      // أ) جلب subject_id مباشرة من الامتحان
      const { data: examData, error: eErr } = await supabase
        .from('exams')
        .select('subject_id')
        .eq('id', examId)
        .maybeSingle();

      if (eErr) console.error("⚠️ [AuthHelper] Exam Fetch Error:", eErr.message);
      if (!examData) {
          console.log(`❌ [AuthHelper] Exam ${examId} not found.`);
          return false;
      }
      subjectId = examData.subject_id;
    }

    if (!subjectId) {
        console.log("❌ [AuthHelper] Could not determine Subject ID.");
        return false;
    }
    console.log(`📍 [AuthHelper] Found Subject ID: ${subjectId}`);

    // ---------------------------------------------------------
    // الخطوة 2: العثور على course_id (معرف الكورس) من المادة
    // ---------------------------------------------------------
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id')
      .eq('id', subjectId)
      .maybeSingle();
    
    const courseId = subjectData?.course_id;
    console.log(`📍 [AuthHelper] Found Course ID: ${courseId || 'None'}`);

    // ---------------------------------------------------------
    // الخطوة 3: التحقق من الاشتراكات
    // ---------------------------------------------------------

    // أولاً: هل المستخدم مشترك في "الكورس الكامل"؟
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) {
          console.log("✅ [AuthHelper] Success: Found Full Course Access.");
          return true; 
      }
    }

    // ثانياً: هل المستخدم مشترك في "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        console.log("✅ [AuthHelper] Success: Found Specific Subject Access.");
        return true;
    }

    // ❌ لا يوجد أي اشتراك
    console.log(`⛔ [AuthHelper] Denied: No access record found for User ${userId} in Subject ${subjectId} or Course ${courseId}.`);
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] CRITICAL ERROR:", error);
    return false;
  }
}
