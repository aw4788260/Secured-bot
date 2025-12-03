// lib/authHelper.js
import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  // 1. التحقق المبدئي
  if (!userId) {
      console.log("❌ [AuthHelper] Missing User ID");
      return false;
  }
  if (!deviceId) {
      console.log(`⛔ [AuthHelper] No Device ID for User ${userId}`);
      return false;
  }

  try {
    // 2. التحقق من بصمة الجهاز
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (!deviceData || deviceData.fingerprint !== deviceId) {
        console.log(`⛔ [AuthHelper] Device Mismatch! User: ${userId} | Reg: ${deviceData?.fingerprint} | New: ${deviceId}`);
        return false; 
    }

    // =========================================================
    // تحديد المادة (Subject)
    // =========================================================
    let subjectId = null;
    let contentType = "";

    if (videoId) {
      contentType = "Video";
      const { data: v } = await supabase.from('videos').select('chapter_id').eq('id', videoId).maybeSingle();
      if (v) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', v.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (pdfId) {
      contentType = "PDF";
      // ✅ البحث في جدول pdfs
      const { data: p } = await supabase.from('pdfs').select('chapter_id').eq('id', pdfId).maybeSingle();
      if (p) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', p.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      } else {
          console.log(`❌ [AuthHelper] PDF ID ${pdfId} not found in DB`);
      }
    } else if (examId) {
      contentType = "Exam";
      const { data: e } = await supabase.from('exams').select('subject_id').eq('id', examId).maybeSingle();
      if (e) subjectId = e.subject_id;
    }

    if (!subjectId) {
        console.log(`❌ [AuthHelper] Could not determine Subject ID for ${contentType}`);
        return false;
    }

    // =========================================================
    // التحقق من الصلاحيات (المنطق المعدل)
    // =========================================================

    // أ) جلب معرف الكورس التابعة له هذه المادة
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id, title')
      .eq('id', subjectId)
      .maybeSingle();
    
    const courseId = subjectData?.course_id;
    const subjectTitle = subjectData?.title || "Unknown";

    // --- تحقق 1: هل يمتلك "الكورس كاملاً"؟ (الأولوية لهذا) ---
    if (courseId) {
      const { data: courseAccess, error } = await supabase
        .from('user_course_access')
        .select('id') 
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) {
          // ✅ نجاح: يمتلك الكورس الكامل
          // console.log(`✅ [AuthHelper] Access Granted (Full Course) | User: ${userId} | Course: ${courseId}`);
          return true;
      } else {
          // لم نجد صلاحية كورس كامل، نسجل ذلك للمتابعة
          // console.log(`ℹ️ [AuthHelper] No Full Course Access | User: ${userId} | Course: ${courseId}`);
      }
    } else {
        // console.log(`⚠️ [AuthHelper] Subject ${subjectId} has NO Course ID linked.`);
    }

    // --- تحقق 2: هل يمتلك "المادة المحددة"؟ ---
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        // ✅ نجاح: يمتلك المادة
        // console.log(`✅ [AuthHelper] Access Granted (Specific Subject) | User: ${userId} | Subject: ${subjectId}`);
        return true;
    }

    // ❌ فشل في الحالتين
    console.log(`⛔ [AuthHelper] Access Denied | User: ${userId} | Subject: ${subjectId} (${subjectTitle}) | Course Linked: ${courseId || 'None'}`);
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] Critical Error:", error);
    return false;
  }
}
