import { supabase } from './supabaseClient';
import jwt from 'jsonwebtoken';
import { APP_DOMAIN } from './config';

const ALLOWED_DOMAINS = [
    APP_DOMAIN, 
    'localhost'
];

export async function checkUserAccess(req, resourceId = null, resourceType = null) {
  // 🆔 إنشاء معرف للطلب لتتبع اللوجات وسط الزحام
  const reqId = Math.random().toString(36).substring(7).toUpperCase();
  const authTag = `[AuthHelper - ${reqId}]`;

  // 📝 متغيرات سنحتاج طباعتها في حالة الخطأ
  let extractedToken = "NOT_PRESENT";
  let decodedData = "NOT_DECODED";
  let dbUserData = "NOT_FETCHED";

  // 🛠️ دالة طباعة التقرير الشامل عند الخطأ
  const logFullError = (reason, extraDetails = {}) => {
      console.error(`\n❌ ---------------- ${authTag} ACCESS DENIED ----------------`);
      console.error(`📌 Reason: ${reason}`);
      
      const debugReport = {
          reason: reason,
          request_info: {
              url: req.url || 'Unknown',
              method: req.method || 'Unknown',
              headers: req.headers, // 👈 طباعة كل الهيدرز
          },
          tokens_comparison: {
              incoming_token: extractedToken, // 👈 التوكن القادم كاملاً
              db_token: dbUserData?.jwt_token || 'NOT_IN_DB' // 👈 التوكن في الداتابيز كاملاً
          },
          decoded_jwt: decodedData,
          database_record: dbUserData, // 👈 صف المستخدم كاملاً من الداتابيز
          ...extraDetails
      };

      // طباعة التقرير كـ JSON منسق
      console.error(JSON.stringify(debugReport, null, 2));
      console.error(`------------------------------------------------------------\n`);
  };

  const log = (msg) => console.log(`🛡️ ${authTag} ${msg}`);

  try {
      // =========================================================
      // 1. فحص المصدر (Source Check)
      // =========================================================
      const referer = req.headers['referer'] || '';
      const host = req.headers['host'] || '';
      const incomingSecret = req.headers['x-app-secret'];
      const validSecret = process.env.APP_SECRET; 

      const isAppRequest = (!referer && incomingSecret && incomingSecret === validSecret);
      const isSourceValid = 
        isAppRequest || 
        referer.includes(host) || 
        ALLOWED_DOMAINS.some(domain => referer.includes(domain));

      if (!isSourceValid) {
          logFullError('Invalid Source / Referer Blocked', {
              check_details: { referer, host, isAppRequest, secrets_match: incomingSecret === validSecret }
          });
          return false; 
      }

      // =========================================================
      // 2. استخراج التوكن وبصمة الجهاز
      // =========================================================
      const authHeader = req.headers['authorization'];
      const deviceIdFromHeader = req.headers['x-device-id'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
          logFullError('Missing or Invalid Authorization Header');
          return false;
      }
      
      extractedToken = authHeader.split(' ')[1]; // حفظ التوكن للوجات

      if (!deviceIdFromHeader) {
          logFullError('Missing Device ID Header');
          return false;
      }

      // =========================================================
      // 3. فك التوكن والتحقق من التوقيع
      // =========================================================
      try {
          decodedData = jwt.verify(extractedToken, process.env.JWT_SECRET);
      } catch (error) {
          decodedData = "INVALID_SIGNATURE_OR_EXPIRED";
          logFullError('JWT Verification Failed', { jwt_error: error.message });
          return false;
      }

      const safeUserId = decodedData.userId;
      const deviceIdFromToken = decodedData.deviceId;

      // =========================================================
      // 4. مطابقة بصمة الجهاز (Header vs Token)
      // =========================================================
      if (deviceIdFromToken !== deviceIdFromHeader) {
          logFullError('Device Spoofing (Header != Token)', {
              token_device_id: deviceIdFromToken,
              header_device_id: deviceIdFromHeader
          });
          return false;
      }

      // حقن المعرف الآمن
      req.headers['x-user-id'] = safeUserId;

      // =========================================================
      // 5. التحقق من قاعدة البيانات
      // =========================================================
      const { data: userData, error: userErr } = await supabase
          .from('users')
          // 👇 نجلب كل شيء نحتاجه للمقارنة
          .select('id, first_name, jwt_token, is_blocked, devices(fingerprint)') 
          .eq('id', safeUserId)
          .maybeSingle();

      if (userErr) {
          logFullError('DB Error Fetching User', { db_error: userErr });
          return false;
      }

      if (!userData) {
          logFullError('User Not Found in DB', { user_id_searched: safeUserId });
          return false;
      }

      dbUserData = userData; // حفظ البيانات للوجات

      if (userData.is_blocked) {
          logFullError('User is Blocked in DB');
          return false;
      }

      // أ) التحقق من تطابق التوكن (Login Conflict)
      if (userData.jwt_token !== extractedToken) {
          logFullError('Token Mismatch (Multi-Login Detected)', {
              match_status: 'FAILED',
              note: 'The token in DB is different from the token sent. User likely logged in elsewhere.'
          });
          return false;
      }

      // ب) التحقق من بصمة الجهاز في القاعدة
      const dbFingerprint = userData.devices ? (Array.isArray(userData.devices) ? userData.devices[0]?.fingerprint : userData.devices.fingerprint) : null;

      if (dbFingerprint !== deviceIdFromToken) {
          logFullError('DB Device Mismatch', {
              db_fingerprint: dbFingerprint,
              token_device_id: deviceIdFromToken
          });
          return false;
      }

      // المستخدم موثوق ✅
      if (!resourceId) return true;

      // =========================================================
      // 6. التحقق من صلاحيات المحتوى (Content Permissions)
      // =========================================================
      let subjectId = null;
      let resourceData = null;

      // جلب بيانات المحتوى
      if (resourceType === 'video') {
         const { data } = await supabase.from('videos').select('chapter_id, chapters(subject_id)').eq('id', resourceId).single();
         resourceData = data;
         if (data?.chapters) subjectId = data.chapters.subject_id;
      } else if (resourceType === 'pdf') {
         const { data } = await supabase.from('pdfs').select('chapter_id, chapters(subject_id)').eq('id', resourceId).single();
         resourceData = data;
         if (data?.chapters) subjectId = data.chapters.subject_id;
      } else if (resourceType === 'exam') {
         const { data } = await supabase.from('exams').select('subject_id').eq('id', resourceId).single();
         resourceData = data;
         if (data) subjectId = data.subject_id;
      }

      if (!subjectId) {
          logFullError('Resource/Subject Not Found', { resourceId, resourceType, fetched_data: resourceData });
          return false;
      }

      // فحص الاشتراكات
      const { data: subjectData } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
      const courseId = subjectData?.course_id;
      
      let accessFound = false;
      let checkType = 'NONE';

      // 1. فحص الكورس
      if (courseId) {
         const { data: access } = await supabase.from('user_course_access').select('course_id').eq('user_id', safeUserId).eq('course_id', courseId).maybeSingle();
         if (access) {
             accessFound = true;
             checkType = 'COURSE_ACCESS';
         }
      }

      // 2. فحص المادة
      if (!accessFound) {
         const { data: subAccess } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', safeUserId).eq('subject_id', subjectId).maybeSingle();
         if (subAccess) {
             accessFound = true;
             checkType = 'SUBJECT_ACCESS';
         }
      }

      if (accessFound) return true;

      logFullError('Content Access Denied (No Subscription)', {
          resource_id: resourceId,
          resource_type: resourceType,
          subject_id: subjectId,
          course_id: courseId,
          user_id: safeUserId
      });
      return false;

  } catch (error) {
      logFullError('Critical System Error', { error_message: error.message, stack: error.stack });
      return false;
  }
}
