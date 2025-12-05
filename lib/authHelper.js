import { supabase } from './supabaseClient';

// هذا الكود السري يجب أن يكون مطابقاً لما في تطبيق الأندرويد
const APP_SECRET = 'My_Sup3r_S3cr3t_K3y_For_Android_App_Only'; 

export async function checkUserAccess(req, resourceId = null, resourceType = null) {
  
  // 1. القراءة من الهيدرز (Headers) وليس الرابط
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];
  const appSecret = req.headers['x-app-secret']; // للأندرويد
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';

  // 2. التحقق من المصدر (لمنع تشغيل الروابط خارج موقعك أو تطبيقك)
  if (appSecret) {
      // طلب قادم من التطبيق
      if (appSecret !== APP_SECRET) {
          console.log(`⛔ [Auth] محاولة اختراق: App Secret غير صحيح`);
          return false;
      }
  } else {
      // طلب قادم من الويب/تليجرام (يجب أن يكون الـ Referer من نفس الدومين)
      if (!referer.includes(host) && !referer.includes('telegram')) {
           console.log(`⛔ [Auth] مصدر خارجي مرفوض: ${referer}`);
           return false; 
      }
  }

  // 3. التحقق من هوية المستخدم
  if (!userId || !deviceId) {
      console.log("⛔ [Auth] بيانات الهوية ناقصة في الهيدر");
      return false;
  }

  try {
    // 4. مطابقة بصمة الجهاز (Device Binding)
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (!deviceData || deviceData.fingerprint !== deviceId) {
        console.log(`⛔ [Auth] جهاز غير مطابق!`);
        return false; 
    }

    // إذا لم يكن هناك مورد محدد (فقط تحقق دخول)، فالنتيجة مقبولة
    if (!resourceId) return true;

    // =========================================================
    // 5. التحقق من صلاحية الاشتراك (Authorization)
    // =========================================================
    let subjectId = null;

    if (resourceType === 'video') {
      const { data } = await supabase.from('videos').select('chapter_id, chapters(subject_id)').eq('id', resourceId).single();
      if (data?.chapters) subjectId = data.chapters.subject_id;

    } else if (resourceType === 'pdf') {
      const { data } = await supabase.from('pdfs').select('chapter_id, chapters(subject_id)').eq('id', resourceId).single();
      if (data?.chapters) subjectId = data.chapters.subject_id;

    } else if (resourceType === 'exam') {
      const { data } = await supabase.from('exams').select('subject_id').eq('id', resourceId).single();
      if (data) subjectId = data.subject_id;
    }

    if (!subjectId) return false;

    // أ) فحص الكورس الكامل
    const { data: subjectData } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
    if (subjectData?.course_id) {
       const { data: access } = await supabase.from('user_course_access').select('id').match({ user_id: userId, course_id: subjectData.course_id }).maybeSingle();
       if (access) return true;
    }

    // ب) فحص المادة المحددة
    const { data: subAccess } = await supabase.from('user_subject_access').select('id').match({ user_id: userId, subject_id: subjectId }).maybeSingle();
    if (subAccess) return true;

    return false;

  } catch (error) {
    console.error("💥 [Auth] Error:", error);
    return false;
  }
}
