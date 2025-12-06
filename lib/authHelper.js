import { supabase } from './supabaseClient';

// هذا الكود السري يجب أن يكون مطابقاً لما في تطبيق الأندرويد
const APP_SECRET = 'My_Sup3r_S3cr3t_K3y_For_Android_App_Only'; 

// ✅ القائمة البيضاء للدومينات المسموح لها بتشغيل الموقع
const ALLOWED_DOMAINS = [
    'courses.aw478260.dpdns.org', 
    'localhost'
];

export async function checkUserAccess(req, resourceId = null, resourceType = null) {
  
  // إنشاء معرف تتبع فريد
  const authTag = `[AuthHelper]`;
  const log = (msg) => console.log(`🛡️ ${authTag} ${msg}`);
  const errLog = (msg) => console.error(`❌ ${authTag} ${msg}`);

  // 1. استخراج البيانات
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];
  const appSecret = req.headers['x-app-secret']; 
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';

  log(`Checking -> User: ${userId} | Referer: ${referer} | Host: ${host}`);

  // 2. التحقق من المصدر (Source Validation)
  let isSourceValid = false;

  if (appSecret) {
      // أ) طلب من التطبيق
      if (appSecret === APP_SECRET) isSourceValid = true;
      else errLog(`Invalid App Secret: ${appSecret}`);
  } else {
      // ب) طلب من المتصفح (فحص الـ Referer)
      // السماح إذا كان الـ Referer يحتوي على الـ Host أو أي دومين من القائمة البيضاء أو تليجرام
      if (
          referer.includes(host) || 
          referer.includes('telegram') || 
          ALLOWED_DOMAINS.some(domain => referer.includes(domain))
      ) {
          isSourceValid = true;
      } else {
          errLog(`⛔ Referer Blocked! Expected one of: [${host}, telegram, ${ALLOWED_DOMAINS.join(', ')}]. Got: "${referer}"`);
      }
  }

  if (!isSourceValid) return false; // ❌ تم الرفض بسبب المصدر

  // 3. التحقق من الهوية
  if (!userId || !deviceId) {
      errLog("Missing Headers");
      return false;
  }

  try {
    // 4. مطابقة الجهاز
    const { data: deviceData, error: devErr } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (devErr || !deviceData) {
        errLog(`No device found for user ${userId}`);
        return false;
    }

    if (deviceData.fingerprint !== deviceId) {
        errLog(`Device Mismatch! DB: ${deviceData.fingerprint} != Header: ${deviceId}`);
        return false; 
    }

    if (!resourceId) return true;

    // 5. التحقق من الاشتراك
    let subjectId = null;

    // تحديد المادة بناءً على نوع الموارد
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

    if (!subjectId) {
        errLog(`Resource ${resourceId} not found or not linked to a subject.`);
        return false;
    }

    // أ) فحص الكورس الكامل
    const { data: subjectData } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
    if (subjectData?.course_id) {
       const { data: access } = await supabase.from('user_course_access').select('id').match({ user_id: userId, course_id: subjectData.course_id }).maybeSingle();
       if (access) return true; // ✅ مشترك كورس كامل
    }

    // ب) فحص المادة المحددة
    const { data: subAccess } = await supabase.from('user_subject_access').select('id').match({ user_id: userId, subject_id: subjectId }).maybeSingle();
    if (subAccess) return true; // ✅ مشترك مادة

    errLog(`⛔ No subscription found for User ${userId} on Subject ${subjectId}`);
    return false;

  } catch (error) {
    errLog(`System Error: ${error.message}`);
    return false;
  }
}
