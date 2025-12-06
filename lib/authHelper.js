import { supabase } from './supabaseClient';

// هذا الكود السري يجب أن يكون مطابقاً لما في تطبيق الأندرويد
const APP_SECRET = 'My_Sup3r_S3cr3t_K3y_For_Android_App_Only'; 

export async function checkUserAccess(req, resourceId = null, resourceType = null) {
  
  // إنشاء معرف تتبع فريد لهذا الطلب
  const authTag = `[AuthHelper-${Math.random().toString(36).substring(7).toUpperCase()}]`;
  const log = (msg) => console.log(`🛡️ ${authTag} ${msg}`);
  const errLog = (msg) => console.error(`❌ ${authTag} ${msg}`);

  log(`Checking Access -> Resource: ${resourceId || 'None'} (${resourceType || 'General'})`);

  // 1. استخراج البيانات من الهيدرز
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];
  const appSecret = req.headers['x-app-secret']; // للأندرويد
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';

  log(`📥 Headers -> User: ${userId} | Device: ${deviceId} | AppSecret: ${appSecret ? 'Yes' : 'No'} | Referer: ${referer}`);

  // 2. التحقق من المصدر (Source Validation)
  if (appSecret) {
      // أ) طلب قادم من التطبيق
      if (appSecret !== APP_SECRET) {
          errLog(`⛔ Secret Key Mismatch! Received: ${appSecret}`);
          return false;
      }
      log(`✅ App Secret Valid.`);
  } else {
      // ب) طلب قادم من الويب/تليجرام
      // (نتحقق أن الـ Referer يحتوي على الـ Host أو كلمة telegram)
      if (!referer.includes(host) && !referer.includes('telegram')) {
           errLog(`⛔ Invalid Referer. Expected host: ${host}, Got: ${referer}`);
           return false; 
      }
      log(`✅ Web/Telegram Referer Valid.`);
  }

  // 3. التحقق من وجود الهوية
  if (!userId || !deviceId) {
      errLog("⛔ Missing Identity Headers (x-user-id or x-device-id).");
      return false;
  }

  try {
    // 4. مطابقة بصمة الجهاز (Device Binding)
    log(`🔍 Checking Device Binding for User ${userId}...`);
    
    const { data: deviceData, error: devErr } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', userId)
        .maybeSingle();

    if (devErr || !deviceData) {
        errLog(`⛔ No device record found for user ${userId}. DB Error: ${devErr?.message}`);
        return false;
    }

    if (deviceData.fingerprint !== deviceId) {
        errLog(`⛔ Device Mismatch! DB: ${deviceData.fingerprint} vs Header: ${deviceId}`);
        return false; 
    }
    log(`✅ Device Fingerprint Matched.`);

    // إذا لم يكن هناك مورد محدد (فقط تحقق دخول)، فالنتيجة مقبولة
    if (!resourceId) {
        log(`✅ General Access Granted (No resource specified).`);
        return true;
    }

    // =========================================================
    // 5. التحقق من صلاحية الاشتراك (Authorization)
    // =========================================================
    log(`🔍 Verifying subscription for ${resourceType} ID: ${resourceId}...`);
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
        errLog(`⛔ Could not determine Subject ID for ${resourceType} ${resourceId}. Item might not exist.`);
        return false;
    }
    log(`ℹ️ Resolved Subject ID: ${subjectId}`);

    // أ) فحص الكورس الكامل
    const { data: subjectData } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
    
    if (subjectData?.course_id) {
       const { data: access } = await supabase.from('user_course_access').select('id').match({ user_id: userId, course_id: subjectData.course_id }).maybeSingle();
       if (access) {
           log(`✅ Authorized via Full Course Access (Course ID: ${subjectData.course_id}).`);
           return true;
       }
    }

    // ب) فحص المادة المحددة
    const { data: subAccess } = await supabase.from('user_subject_access').select('id').match({ user_id: userId, subject_id: subjectId }).maybeSingle();
    if (subAccess) {
        log(`✅ Authorized via Specific Subject Access.`);
        return true;
    }

    errLog(`⛔ Access Denied. No active subscription found for Subject ${subjectId}.`);
    return false;

  } catch (error) {
    errLog(`💥 CRITICAL ERROR: ${error.message}`);
    return false;
  }
}
