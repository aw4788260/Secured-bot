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

  // ---------------------------------------------------------
  // 1. استخراج البيانات (النظام الجديد: من الهيدرز)
  // ---------------------------------------------------------
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];
  const appSecret = req.headers['x-app-secret']; 
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';

  log(`Checking -> User: ${userId} | Resource: ${resourceType} ${resourceId}`);

  // ---------------------------------------------------------
  // 2. التحقق من المصدر (Source Validation)
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // 3. التحقق من الهوية والبصمة (Device Lock)
  // ---------------------------------------------------------
  if (!userId || !deviceId) {
      errLog("Missing Headers");
      return false;
  }

  try {
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

    // إذا لم يكن هناك مورد محدد (فقط تسجيل دخول)، فالنتيجة مقبولة
    if (!resourceId) return true;

    // =========================================================
    // 4. تحديد Subject ID (نفس منطق الكود القديم)
    // =========================================================
    let subjectId = null;

    if (resourceType === 'video') {
      const { data } = await supabase.from('videos').select('chapter_id').eq('id', resourceId).single();
      if (data) {
          const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', data.chapter_id).single();
          if (chapter) subjectId = chapter.subject_id;
      }
    } else if (resourceType === 'pdf') {
      const { data } = await supabase.from('pdfs').select('chapter_id').eq('id', resourceId).single();
      if (data) {
          const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', data.chapter_id).single();
          if (chapter) subjectId = chapter.subject_id;
      }
    } else if (resourceType === 'exam') {
      const { data } = await supabase.from('exams').select('subject_id').eq('id', resourceId).single();
      if (data) subjectId = data.subject_id;
    }

    if (!subjectId) {
        errLog(`Could not determine Subject ID for ${resourceType} ${resourceId}`);
        return false;
    }

    // =========================================================
    // 5. جلب الكورس الأب (نفس منطق الكود القديم)
    // =========================================================
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('course_id, title')
      .eq('id', subjectId)
      .single();
    
    const targetCourseId = subjectData?.course_id;
    log(`ℹ️ Target: Subject [${subjectData?.title}] -> Course ID [${targetCourseId}]`);

    // =========================================================
    // 6. التحقق من الصلاحيات (Logic Replication)
    // =========================================================

    // ✅ الفحص الأول: هل يمتلك "الكورس كاملاً"؟
    if (targetCourseId) {
      log(`🔍 Checking Full Course Access via fetching ALL courses...`);
      
      // نجلب كل الكورسات التي يمتلكها المستخدم (كما في الكود القديم)
      const { data: allUserAccess } = await supabase
        .from('user_course_access')
        .select('course_id') 
        .eq('user_id', userId);
      
      const ownedCourses = allUserAccess ? allUserAccess.map(x => x.course_id) : [];
      log(`   User owns courses: [${ownedCourses.join(', ')}]`);

      // استخدام (==) للمقارنة المرنة (بين رقم ونص) - هذا هو السر
      const hasFullAccess = ownedCourses.some(id => id == targetCourseId);

      if (hasFullAccess) {
          log(`✅ Authorized via Full Course Access (Matched Course ${targetCourseId}).`);
          return true; 
      }
      log(`⚠️ Course ${targetCourseId} not found in user's list.`);
    }

    // ✅ الفحص الثاني: (فقط إذا فشل الأول) هل يمتلك "المادة المحددة"؟
    log(`🔍 Checking Specific Subject Access...`);
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('id') 
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (subjectAccess) {
        log(`✅ Authorized via Specific Subject Access.`);
        return true;
    }

    // ❌ فشل في جميع الفحوصات
    errLog(`⛔ Access Denied for User ${userId} on Subject ${subjectId}`);
    return false;

  } catch (error) {
    errLog(`System Error: ${error.message}`);
    return false;
  }
}
