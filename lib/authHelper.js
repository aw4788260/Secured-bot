import { supabase } from './supabaseClient';

export async function checkUserAccess(userId, videoId = null, pdfId = null, examId = null, deviceId = null) {
  
  // 1. التحقق المبدئي
  if (!userId || !deviceId) return false;

  try {
    // 2. التحقق من بصمة الجهاز (Security Check)
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
    // الخطوة 1: تحديد المادة (Subject ID) بناءً على نوع المحتوى
    // =========================================================
    let subjectId = null;

    if (videoId) {
      // أ) حالة الفيديو
      const { data: v } = await supabase.from('videos').select('chapter_id').eq('id', videoId).maybeSingle();
      if (v) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', v.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (pdfId) {
      // ب) حالة الـ PDF (✅ التعديل الأساسي هنا: البحث في جدول pdfs)
      const { data: p } = await supabase.from('pdfs').select('chapter_id').eq('id', pdfId).maybeSingle();
      if (p) {
          const { data: c } = await supabase.from('chapters').select('subject_id').eq('id', p.chapter_id).maybeSingle();
          if (c) subjectId = c.subject_id;
      }
    } else if (examId) {
      // ج) حالة الامتحان
      const { data: e } = await supabase.from('exams').select('subject_id').eq('id', examId).maybeSingle();
      if (e) subjectId = e.subject_id;
    }

    if (!subjectId) return false;

    // =========================================================
    // الخطوة 2: التحقق من الصلاحيات (الكورس أو المادة)
    // =========================================================

    // جلب بيانات الكورس المرتبط بالمادة
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id')
      .eq('id', subjectId)
      .maybeSingle();
    
    const targetCourseId = subjectData?.course_id;

    // 1. التحقق من صلاحية الكورس (الأولوية)
    if (targetCourseId) {
        // نجلب كل الكورسات التي يملكها المستخدم
        const { data: allUserAccess } = await supabase
            .from('user_course_access')
            .select('course_id')
            .eq('user_id', userId);
            
        const ownedCourses = allUserAccess ? allUserAccess.map(x => x.course_id) : [];

        // ✅ استخدام (==) للمقارنة المرنة وحل مشاكل أنواع البيانات
        const hasFullAccess = ownedCourses.some(id => id == targetCourseId);

        if (hasFullAccess) return true;
    }

    // 2. التحقق من صلاحية المادة المحددة (إذا فشل الكورس)
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) return true;

    // رفض الوصول إذا لم ينجح أي شرط
    return false;

  } catch (error) {
    console.error("💥 [AuthHelper] Error:", error);
    return false;
  }
}
