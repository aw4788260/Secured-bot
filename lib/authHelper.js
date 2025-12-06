import { supabase } from './supabaseClient';

// هذا الكود السري يجب أن يكون مطابقاً لما في تطبيق الأندرويد
const APP_SECRET = 'My_Sup3r_S3cr3t_K3y_For_Android_App_Only'; 

// القائمة البيضاء للدومينات
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

  log(`Checking -> User: ${userId} | Resource: ${resourceType} ${resourceId}`);

  // 2. التحقق من المصدر (Source Validation)
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
        errLog(`Device Mismatch!`);
        return false; 
    }

    if (!resourceId) return true;

    // =========================================================
    // 5. المنطق الذكي: تحديد المادة والكورس
    // =========================================================
    let subjectId = null;

    // أ) تحديد ID المادة حسب نوع المورد
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

    // ب) جلب بيانات المادة لمعرفة "الكورس الأب"
    const { data: subjectData } = await supabase
        .from('subjects')
        .select('id, course_id, title')
        .eq('id', subjectId)
        .single();
    
    const courseId = subjectData?.course_id;
    log(`ℹ️ Target Subject: ${subjectData?.title} (ID: ${subjectId}) -> Parent Course ID: ${courseId}`);

    // =========================================================
    // 6. التحقق الهرمي (Hierarchical Check)
    // =========================================================

    // الخيار الأول (الأقوى): هل يملك "الكورس الكامل"؟
    if (courseId) {
       // نبحث عن سجل في جدول اشتراكات الكورسات
       const { data: courseAccess } = await supabase
           .from('user_course_access')
           .select('id')
           .match({ user_id: userId, course_id: courseId })
           .maybeSingle();
       
       if (courseAccess) {
           log(`✅ Authorized via Full Course Access (Course #${courseId}).`);
           return true; // 🚀 خروج فوري بالموافقة
       }
       log(`⚠️ No Full Course access found. Checking specific subject...`);
    }

    // الخيار الثاني (الاحتياطي): هل يملك "المادة المحددة"؟
    const { data: subjectAccess } = await supabase
        .from('user_subject_access')
        .select('id')
        .match({ user_id: userId, subject_id: subjectId })
        .maybeSingle();

    if (subjectAccess) {
        log(`✅ Authorized via Specific Subject Access.`);
        return true; 
    }

    // إذا فشل الاثنين
    errLog(`⛔ Access Denied. User ${userId} has NEITHER Course #${courseId} NOR Subject #${subjectId}.`);
    return false;

  } catch (error) {
    errLog(`System Error: ${error.message}`);
    return false;
  }
}
