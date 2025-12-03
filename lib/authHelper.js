import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  // 1. التحقق المبدئي من البيانات الأساسية
  if (!userId || userId === 'undefined' || userId === 'null') {
      console.log("❌ [AuthHelper] User ID missing.");
      return false;
  }

  // 2. التحقق من وجود معرف الجهاز (Device ID)
  if (!deviceId || deviceId === 'undefined' || deviceId === 'null') {
      console.log(`⛔ [AuthHelper] Access Denied: No Device ID provided for User ${userId}`);
      return false;
  }

  try {
    // 3. التحقق من بصمة الجهاز في قاعدة البيانات
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    // إذا لم نجد جهازاً مسجلاً، أو كانت البصمة مختلفة
    if (!deviceData || deviceData.fingerprint !== deviceId) {
        console.log(`⛔ [AuthHelper] Device Mismatch! Registered: ${deviceData?.fingerprint}, Provided: ${deviceId}`);
        return false; 
    }

    // =========================================================
    // الخطوة 1: تحديد معرف المادة (Subject ID) بناءً على المدخلات
    // =========================================================
    let subjectId = null;

    if (videoId) {
      // أ) حالة الفيديو: نبحث في جدول videos
      const { data: videoData } = await supabase
        .from('videos')
        .select('chapter_id')
        .eq('id', videoId)
        .maybeSingle();
      
      if (videoData) {
          // جلب subject_id من الشابتر
          const { data: chapterData } = await supabase
            .from('chapters')
            .select('subject_id')
            .eq('id', videoData.chapter_id)
            .maybeSingle();

          if (chapterData) subjectId = chapterData.subject_id;
      }

    } else if (pdfId) {
      // ب) حالة ملف PDF: نبحث في جدول pdfs
      const { data: pdfData } = await supabase
        .from('pdfs')
        .select('chapter_id')
        .eq('id', pdfId)
        .maybeSingle();
      
      if (pdfData) {
          // جلب subject_id من الشابتر
          const { data: chapterData } = await supabase
            .from('chapters')
            .select('subject_id')
            .eq('id', pdfData.chapter_id)
            .maybeSingle();

          if (chapterData) subjectId = chapterData.subject_id;
      } else {
          console.log(`❌ [AuthHelper] PDF ID ${pdfId} not found in DB`);
      }

    } else if (examId) {
      // ج) حالة الامتحان: نبحث في جدول exams
      const { data: examData } = await supabase
        .from('exams')
        .select('subject_id')
        .eq('id', examId)
        .maybeSingle();

      if (examData) subjectId = examData.subject_id;
    }

    // إذا لم نتمكن من تحديد المادة، نرفض الطلب
    if (!subjectId) {
        console.log("❌ [AuthHelper] Could not determine Subject ID from inputs.");
        return false;
    }

    // =========================================================
    // الخطوة 2: جلب بيانات الكورس المرتبط بهذه المادة
    // =========================================================
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id')
      .eq('id', subjectId)
      .maybeSingle();
    
    const targetCourseId = subjectData?.course_id;

    // =========================================================
    // الخطوة 3: التحقق من الصلاحيات (الأولوية للكورس الكامل)
    // =========================================================

    // ✅ الفحص الأول: هل يمتلك "الكورس كاملاً"؟
    if (targetCourseId) {
      // نجلب كل الكورسات التي يمتلكها المستخدم للتحقق بدقة
      const { data: allUserAccess } = await supabase
        .from('user_course_access')
        .select('course_id') 
        .eq('user_id', userId);
      
      const ownedCourses = allUserAccess ? allUserAccess.map(x => x.course_id) : [];

      // استخدام (==) للمقارنة المرنة (بين رقم ونص)
      const hasFullAccess = ownedCourses.some(id => id == targetCourseId);

      if (hasFullAccess) {
          // ✅ نجاح: يمتلك الكورس الكامل، اسمح بالدخول فوراً
          return true; 
      }
    }

    // ✅ الفحص الثاني: (فقط إذا فشل الأول) هل يمتلك "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        // ✅ نجاح: يمتلك المادة
        return true;
    }

    // ❌ فشل في جميع الفحوصات
    console.log(`⛔ [AuthHelper] Access Denied for User ${userId}`);
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] Critical Error:", error);
    return false;
  }
}
