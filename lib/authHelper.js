import { supabase } from './supabaseClient';

// هذا الكود السري يجب أن يكون مطابقاً لما في تطبيق الأندرويد
const APP_SECRET = 'My_Sup3r_S3cr3t_K3y_For_Android_App_Only'; 

// القائمة البيضاء للدومينات
const ALLOWED_DOMAINS = [
    'courses.aw478260.dpdns.org', 
    'localhost'
];

export async function checkUserAccess(req, resourceId = null, resourceType = null) {
  
  const authTag = `[AuthHelper]`;
  const log = (msg) => console.log(`🛡️ ${authTag} ${msg}`);
  const errLog = (msg) => console.error(`❌ ${authTag} ${msg}`);

  // 1. استخراج البيانات
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];
  const appSecret = req.headers['x-app-secret']; 
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';

  log(`Checking -> User: ${userId} | Resource: ${resourceType} ${resourceId}`);

  // 2. التحقق من المصدر
  let isSourceValid = false;
  if (appSecret) {
      if (appSecret === APP_SECRET) isSourceValid = true;
      else errLog(`Invalid App Secret: ${appSecret}`);
  } else {
      if (
          referer.includes(host) || 
          referer.includes('telegram') || 
          ALLOWED_DOMAINS.some(domain => referer.includes(domain))
      ) {
          isSourceValid = true;
      } else {
          errLog(`⛔ Referer Blocked! Got: "${referer}"`);
      }
  }

  if (!isSourceValid) return false;

  // 3. التحقق من الهوية
  if (!userId || !deviceId) {
      errLog("Missing Headers");
      return false;
  }

  try {
    // 4. مطابقة الجهاز
    const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (!deviceData || deviceData.fingerprint !== deviceId) {
        errLog(`Device Mismatch!`);
        return false; 
    }

    if (!resourceId) return true;

    // 5. تحديد Subject ID
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

    if (!subjectId) {
        errLog(`Resource ${resourceId} not linked to a subject.`);
        return false;
    }

    // ب) جلب بيانات المادة والكورس
    const { data: subjectData } = await supabase
        .from('subjects')
        .select('id, course_id, title')
        .eq('id', subjectId)
        .single();
    
    const courseId = subjectData?.course_id;
    log(`ℹ️ Target Subject: ${subjectData?.title} (ID: ${subjectId}) -> Parent Course ID: ${courseId}`);

    // =========================================================
    // 6. التحقق الهرمي (باستخدام .eq بدلاً من .match)
    // =========================================================

    // الخيار الأول: الكورس الكامل
    if (courseId) {
       log(`🔍 Checking Full Course Access (Course ID: ${courseId})...`);
       
       // [✅] تعديل: استخدام .eq لضمان الدقة وتجنب مشاكل الأنواع
       const { data: access, error: accessErr } = await supabase
           .from('user_course_access')
           .select('id')
           .eq('user_id', userId)
           .eq('course_id', courseId)
           .maybeSingle();
       
       // طباعة نتيجة الاستعلام للتشخيص
       if (accessErr) log(`⚠️ DB Error checking course: ${accessErr.message}`);
       
       if (access) {
           log(`✅ Authorized via Full Course Access (Record ID: ${access.id}).`);
           return true; 
       } else {
           log(`⚠️ Query returned no access for User ${userId} on Course ${courseId}. Checking specific subject...`);
       }
    } else {
        log(`ℹ️ Subject ${subjectId} is not linked to any Course.`);
    }

    // الخيار الثاني: المادة المحددة
    log(`🔍 Checking Specific Subject Access (Subject ID: ${subjectId})...`);
    
    const { data: subAccess } = await supabase
        .from('user_subject_access')
        .select('id')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .maybeSingle();

    if (subAccess) {
        log(`✅ Authorized via Specific Subject Access.`);
        return true; 
    }

    errLog(`⛔ Access Denied. User ${userId} has NEITHER Course #${courseId} NOR Subject #${subjectId}.`);
    return false;

  } catch (error) {
    errLog(`System Error: ${error.message}`);
    return false;
  }
}
