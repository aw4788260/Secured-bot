import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  if (!userId || !deviceId) {
      console.log(`❌ [Auth] Missing Data: User=${userId}`);
      return false;
  }

  try {
    // 1. التحقق من الجهاز
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (!deviceData || deviceData.fingerprint !== deviceId) {
        console.log(`⛔ [Auth] Device Mismatch! User: ${userId}`);
        return false; 
    }

    // 2. تحديد المادة
    let subjectId = null;
    let type = "";

    if (videoId) {
      type = "Video";
      const { data: v } = await supabase.from('videos').select('chapter_id').eq('id', videoId).maybeSingle();
      if (v) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', v.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (pdfId) {
      type = "PDF";
      const { data: p } = await supabase.from('pdfs').select('chapter_id').eq('id', pdfId).maybeSingle();
      if (p) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', p.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (examId) {
      type = "Exam";
      const { data: e } = await supabase.from('exams').select('subject_id').eq('id', examId).maybeSingle();
      if (e) subjectId = e.subject_id;
    }

    if (!subjectId) {
        console.log(`❌ [Auth] Subject ID not found for ${type} ID: ${videoId||pdfId||examId}`);
        return false;
    }

    // 3. جلب بيانات الكورس
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id, title')
      .eq('id', subjectId)
      .maybeSingle();
    
    const targetCourseId = subjectData?.course_id;

    // =========================================================
    // 🔥🔥 منطقة التشخيص العميق (DEBUG AREA) 🔥🔥
    // =========================================================
    if (targetCourseId) {
        // 1. اطبع القيم التي نقارن بها لنرى هل هناك مسافات أو اختلاف في النوع
        console.log(`🔍 [DEBUG] Checking Access:`);
        console.log(`   - Target Course ID: '${targetCourseId}' (Type: ${typeof targetCourseId})`);
        console.log(`   - User ID: '${userId}' (Type: ${typeof userId})`);

        // 2. اجلب كل صلاحيات هذا المستخدم واطبعها
        const { data: allUserAccess } = await supabase
            .from('user_course_access')
            .select('course_id')
            .eq('user_id', userId);
            
        const ownedCourses = allUserAccess ? allUserAccess.map(x => x.course_id) : [];
        console.log(`   - User Owns Courses: [ ${ownedCourses.join(', ')} ]`);

        // 3. هل الكورس المطلوب موجود في القائمة؟
        // نستخدم == للمقارنة المرنة بين الأرقام والنصوص
        const hasFullAccess = ownedCourses.some(id => id == targetCourseId);

        if (hasFullAccess) {
            // console.log("✅ [Auth] Match Found! Access Granted.");
            return true;
        } else {
            console.log("⚠️ [Auth] No Match Found in User's Courses.");
        }
    }
    // =========================================================

    // 4. التحقق من المادة (الخطة ب)
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) return true;

    console.log(`⛔ [Access Denied] Final Decision for User ${userId}`);
    return false;

  } catch (error) {
    console.error("💥 [Auth] Error:", error);
    return false;
  }
}
