// lib/authHelper.js
import { supabase } from './supabaseClient';

// ✅ تم إضافة المعامل الخامس: deviceId
export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  // 1. التحقق المبدئي من وجود User ID
  if (!userId || userId === 'undefined' || userId === 'null') {
      console.log("❌ [AuthHelper] User ID missing.");
      return false;
  }

  // 2. [🔒 حماية إضافية] التحقق من بصمة الجهاز
  // نرفض الدخول إذا لم يتم إرسال بصمة الجهاز
  if (!deviceId || deviceId === 'undefined' || deviceId === 'null') {
      console.log(`⛔ [AuthHelper] Access Denied: No Device ID provided for User ${userId}`);
      return false;
  }

  try {
    // التحقق من أن هذا الجهاز هو المسجل للمستخدم في قاعدة البيانات
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    // إذا لم نجد جهازاً مسجلاً، أو كانت البصمة مختلفة عن المرسلة
    if (!deviceData || deviceData.fingerprint !== deviceId) {
        console.log(`⛔ [AuthHelper] Device Mismatch! Registered: ${deviceData?.fingerprint}, Provided: ${deviceId}`);
        return false; // ❌ جهاز غريب يحاول الدخول (أو مشاركة حساب)
    }

    // =========================================================
    // (من هنا يبدأ الكود الأصلي الخاص بك للتحقق من الاشتراكات)
    // =========================================================

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
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('*') 
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) {
          // console.log(`✅ [AuthHelper] Access Granted: User owns full Course ${courseId}`);
          return true; // 🛑 توقف هنا، ومبروك الدخول!
      }
    }

    // ✅ ثانياً: هل يمتلك "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('*') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        // console.log(`✅ [AuthHelper] Access Granted: User owns Subject ${subjectId}`);
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
