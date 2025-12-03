// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  // 1. التحقق المبدئي من وجود User ID
  if (!userId || userId === 'undefined' || userId === 'null') {
      console.log("❌ [AuthHelper] User ID missing.");
      return false;
  }

  // 2. التحقق من بصمة الجهاز
  if (!deviceId || deviceId === 'undefined' || deviceId === 'null') {
      console.log(`⛔ [AuthHelper] Access Denied: No Device ID provided for User ${userId}`);
      return false;
  }

  try {
    // التحقق من أن هذا الجهاز هو المسجل للمستخدم
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (!deviceData || deviceData.fingerprint !== deviceId) {
        console.log(`⛔ [AuthHelper] Device Mismatch! Registered: ${deviceData?.fingerprint}, Provided: ${deviceId}`);
        return false; 
    }

    // =========================================================
    // بداية التحقق من الاشتراك (التعديل هنا)
    // =========================================================

    let subjectId = null;

    // ---------------------------------------------------------
    // الخطوة 1: الوصول لمعرف المادة (Subject ID)
    // ---------------------------------------------------------
    
    if (videoId) {
      // أ) حالة الفيديو: نبحث في جدول videos
      const { data: videoData } = await supabase
        .from('videos')
        .select('chapter_id')
        .eq('id', videoId)
        .maybeSingle();
      
      if (!videoData) return false;
      
      // جلب subject_id من الشابتر
      const { data: chapterData } = await supabase
        .from('chapters')
        .select('subject_id')
        .eq('id', videoData.chapter_id)
        .maybeSingle();

      if (!chapterData) return false;
      subjectId = chapterData.subject_id;

    } else if (pdfId) {
      // ب) حالة الـ PDF: نبحث في جدول pdfs (✅ هذا هو الإصلاح)
      const { data: pdfData } = await supabase
        .from('pdfs')
        .select('chapter_id')
        .eq('id', pdfId)
        .maybeSingle();
      
      if (!pdfData) {
          console.log("❌ [AuthHelper] PDF not found in DB");
          return false;
      }

      // جلب subject_id من الشابتر
      const { data: chapterData } = await supabase
        .from('chapters')
        .select('subject_id')
        .eq('id', pdfData.chapter_id)
        .maybeSingle();

      if (!chapterData) return false;
      subjectId = chapterData.subject_id;

    } else if (examId) {
      // ج) حالة الامتحان
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
    // الخطوة 3: التحقق من الصلاحية
    // ---------------------------------------------------------

    // أولاً: هل يمتلك "الكورس كاملاً"؟
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id') 
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) return true;
    }

    // ثانياً: هل يمتلك "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) return true;

    // فشل في الاثنين
    console.log(`⛔ [AuthHelper] Access Denied for User ${userId} on Subject ${subjectId}`);
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] Error:", error);
    return false;
  }
}
