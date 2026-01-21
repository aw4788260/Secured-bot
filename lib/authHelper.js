import { supabase } from './supabaseClient';
import jwt from 'jsonwebtoken';

// القائمة البيضاء للدومينات
const ALLOWED_DOMAINS = [
    'courses.aw478260.dpdns.org', 
    'localhost'
];

export async function checkUserAccess(req, resourceId = null, resourceType = null) {
  const authTag = `[AuthHelper]`;
  const log = (msg) => console.log(`🛡️ ${authTag} ${msg}`);
  const errLog = (msg) => console.error(`❌ ${authTag} ${msg}`);

  // 1. فحص المصدر (Referer Protection)
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';
  
  // ✅ التعديل هنا: السماح للتطبيق بالمرور
  // تطبيقات الموبايل غالباً ترسل Referer فارغ، لذا نتحقق من وجود بصمة الجهاز أو سر التطبيق كبديل
  const isAppRequest = (!referer && (req.headers['x-device-id'] || req.headers['x-app-secret']));

  const isSourceValid = 
      isAppRequest || // 👈 السماح للتطبيق إذا كان قادماً بدون Referer لكن ببيانات صحيحة
      referer.includes(host) || 
      referer.includes('telegram') || 
      ALLOWED_DOMAINS.some(domain => referer.includes(domain));

  if (!isSourceValid) {
      errLog(`⛔ Blocked Referer: "${referer}" (Headers: DeviceID=${req.headers['x-device-id'] ? 'Yes' : 'No'})`);
      return false; 
  }

  // 2. استخراج التوكن وبصمة الجهاز من الهيدر
  const authHeader = req.headers['authorization'];
  const deviceIdFromHeader = req.headers['x-device-id'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errLog("Missing Authorization Token");
      return false;
  }
  
  if (!deviceIdFromHeader) {
      errLog("Missing Device ID Header");
      return false;
  }

  const token = authHeader.split(' ')[1];
  let decodedToken = null;

  try {
      // 3. فك التوكن والتحقق من التوقيع
      // هذه الخطوة تضمن أن التوكن صادر من سيرفرك ولم يتم التلاعب به
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
      errLog("Invalid or Expired Token");
      return false;
  }

  // استخراج البيانات الآمنة المحفورة داخل التوكن
  const safeUserId = decodedToken.userId;
  const deviceIdFromToken = decodedToken.deviceId;

  // 4. مطابقة بصمة الجهاز (التوكن مقابل الهيدر)
  // هذا يمنع سرقة التوكن واستخدامه على جهاز آخر
  if (deviceIdFromToken !== deviceIdFromHeader) {
      errLog(`🚨 Device Spoofing! Token Device (${deviceIdFromToken}) != Header (${deviceIdFromHeader})`);
      return false;
  }

  // 🔥 [الحقن الآمن] 🔥
  // نضع الآيدي الحقيقي المستخرج من التوكن في الهيدر
  // هذا يجعل باقي ملفات الـ API تعمل كما هي (لأنها تقرأ x-user-id) ولكن بقيمة آمنة وموثقة
  req.headers['x-user-id'] = safeUserId;

  try {
    // 5. التحقق من قاعدة البيانات (الحالة النشطة)
    // نستخدم العمود الجديد jwt_token
    const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('jwt_token, is_blocked, devices(fingerprint)')
        .eq('id', safeUserId)
        .single();

    if (userErr || !userData) {
        errLog("User not found in DB");
        return false;
    }

    if (userData.is_blocked) {
        errLog("User is Blocked");
        return false;
    }

    // أ) التحقق من تطابق التوكن المخزن في العمود الجديد
    // هذا يسمح لك بطرد المستخدم عن طريق حذف القيمة من الداتابيز
    if (userData.jwt_token !== token) {
        errLog("Token Mismatch (User logged out or logged in from another device)");
        return false;
    }

    // ب) التحقق من بصمة الجهاز المسجلة في القاعدة
    // Supabase قد يعيد devices كمصفوفة أو كائن حسب العلاقة
    const dbFingerprint = userData.devices ? (Array.isArray(userData.devices) ? userData.devices[0]?.fingerprint : userData.devices.fingerprint) : null;

    if (dbFingerprint !== deviceIdFromToken) {
        errLog(`⛔ DB Device Mismatch! DB: ${dbFingerprint} | Token: ${deviceIdFromToken}`);
        return false;
    }

    // المستخدم موثوق 100% ✅
    // إذا لم يكن هناك مورد محدد (فقط تحقق من الدخول)، نرجع true
    if (!resourceId) return true;

    // =========================================================
    // 6. التحقق من صلاحيات المحتوى (Content Permissions)
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

    // فحص اشتراك الكورس الكامل
    const { data: subjectData } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
    const courseId = subjectData?.course_id;

    if (courseId) {
       const { data: access } = await supabase.from('user_course_access').select('course_id').eq('user_id', safeUserId).eq('course_id', courseId).maybeSingle();
       if (access) return true;
    }

    // فحص اشتراك المادة المنفصلة
    const { data: subAccess } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', safeUserId).eq('subject_id', subjectId).maybeSingle();
    if (subAccess) return true;

    errLog(`⛔ Content Access Denied.`);
    return false;

  } catch (error) {
    errLog(`System Error: ${error.message}`);
    return false;
  }
}
