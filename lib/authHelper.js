import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  // 1. التحقق المبدئي من البيانات
  if (!userId || !deviceId) {
      console.log(`❌ [AuthHelper] Missing Data: User=${userId}, Device=${deviceId}`);
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
        console.log(`⛔ [AuthHelper] Device Mismatch! User: ${userId}`);
        return false; 
    }

    // =========================================================
    // الخطوة 1: تحديد معرف المادة (Subject ID)
    // =========================================================
    let subjectId = null;

    if (videoId) {
      const { data: v } = await supabase.from('videos').select('chapter_id').eq('id', videoId).maybeSingle();
      if (v) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', v.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (pdfId) {
      // ✅ دعم ملفات PDF
      const { data: p } = await supabase.from('pdfs').select('chapter_id').eq('id', pdfId).maybeSingle();
      if (p) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', p.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (examId) {
      const { data: e } = await supabase.from('exams').select('subject_id').eq('id', examId).maybeSingle();
      if (e) subjectId = e.subject_id;
    }

    if (!subjectId) {
        console.log("❌ [AuthHelper] Could not find Subject ID.");
        return false;
    }

    // =========================================================
    // الخطوة 2: جلب بيانات الكورس المرتبط بهذه المادة
    // =========================================================
    
    // نجلب المادة لنعرف الكورس التابعة له
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id, title')
      .eq('id', subjectId)
      .maybeSingle();
    
    const courseId = subjectData?.course_id;

    // =========================================================
    // الخطوة 3: التحقق (الأولوية للكورس الكامل)
    // =========================================================

    // ✅ التحقق الأول: هل يمتلك الكورس كاملاً؟
    if (courseId) {
      const { data: courseAccess } = await supabase
        .from('user_course_access')
        .select('id') 
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (courseAccess) {
          // ✅ نجاح! يمتلك الكورس، لذا نمنحه الصلاحية فوراً ولا نفحص المادة
          return true;
      } else {
          // للتوضيح في اللوج: الطالب لا يمتلك هذا الكورس، سننتقل لفحص المادة
          console.log(`ℹ️ [Check] User does NOT own Course ${courseId} (for Subject ${subjectId}). Checking Subject access...`);
      }
    }

    // ✅ التحقق الثاني: (فقط إذا فشل الأول) هل يمتلك المادة المحددة؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        // ✅ نجاح! يمتلك المادة
        return true;
    }

    // ❌ فشل في الحالتين
    console.log(`⛔ [Access Denied] User: ${userId}`);
    console.log(`   - Needs Subject: ${subjectId} (${subjectData?.title})`);
    console.log(`   - OR Needs Course: ${courseId || 'None'}`);
    
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] Error:", error);
    return false;
  }
}
