import { supabase } from './supabaseClient';
import { checkUserAccess } from './authHelper';

export async function verifyTeacher(req) {
  console.log("🚀 [verifyTeacher] Starting verification process...");

  // --- تشخيص البيانات القادمة من الطلب (Debug Headers) ---
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const deviceIdHeader = req.headers['x-device-id'] || req.headers['device-id'];
  
  console.log("🔍 [Debug Request] Headers Summary:");
  console.log(`   - Auth Token Exists: ${!!authHeader}`);
  console.log(`   - Device ID Exists: ${!!deviceIdHeader} (Value: ${deviceIdHeader || 'Missing'})`);
  // -------------------------------------------------------

  // 1. التحقق الأساسي (توكن + جهاز)
  console.log("🔍 [verifyTeacher] Step 1: Calling checkUserAccess...");
  
  // ننتظر التحقق من صلاحية الوصول
  const isAuthorized = await checkUserAccess(req);
  console.log(`ℹ️ [verifyTeacher] checkUserAccess result: ${isAuthorized}`);

  if (!isAuthorized) {
    console.error("❌ [verifyTeacher] Failed: Unauthorized Device/Token. Request rejected by checkUserAccess.");
    // طباعة كل الهيدرز في حالة الفشل فقط للمساعدة في التتبع (احذر من مشاركة هذا اللوج علناً)
    console.log("⚠️ [Debug Headers Dump]:", JSON.stringify(req.headers, null, 2));
    return { error: 'Unauthorized Device/Token', status: 401 };
  }

  // checkUserAccess يقوم بحقن x-user-id في الهيدر إذا كان التوكن سليم
  const userId = req.headers['x-user-id'];
  console.log(`🆔 [verifyTeacher] Extracted x-user-id from headers: ${userId}`);

  if (!userId) {
    console.error("❌ [verifyTeacher] Failed: User ID is missing in headers even after authorization.");
    return { error: 'User ID missing', status: 400 };
  }

  // 2. جلب بيانات المستخدم وصلاحيته من قاعدة البيانات
  console.log(`🔍 [verifyTeacher] Step 2: Querying Supabase for user [${userId}]...`);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('role, teacher_profile_id, is_blocked')
    .eq('id', userId)
    .single();

  if (error) {
    console.error("❌ [verifyTeacher] DB Error:", error.message);
    return { error: 'User not found or DB Error', status: 404 };
  }

  if (!user) {
    console.error("❌ [verifyTeacher] Failed: User returned null from DB");
    return { error: 'User not found', status: 404 };
  }

  // طباعة بيانات المستخدم (بدون معلومات حساسة)
  console.log("📄 [verifyTeacher] User Data Retrieved:", { 
    role: user.role, 
    teacherId: user.teacher_profile_id, 
    blocked: user.is_blocked 
  });

  if (user.is_blocked) {
    console.warn("⛔ [verifyTeacher] Failed: User account is blocked");
    return { error: 'Account Blocked', status: 403 };
  }

  // 3. التحقق من الصلاحية (هل هو معلم أو مشرف؟)
  console.log(`⚖️ [verifyTeacher] Step 3: Checking Role validity (Current: ${user.role})`);

  if (user.role !== 'teacher' && user.role !== 'moderator') {
    console.warn(`⛔ [verifyTeacher] Failed: Invalid Role. Expected teacher/moderator, got '${user.role}'`);
    return { error: 'Access Denied: Not a teacher account', status: 403 };
  }

  if (!user.teacher_profile_id) {
    console.warn("⚠️ [verifyTeacher] Failed: No teacher_profile_id linked to this account");
    return { error: 'No teacher profile linked to this account', status: 400 };
  }

  console.log(`✅ [verifyTeacher] Success! Teacher verified. (TeacherID: ${user.teacher_profile_id})`);

  // إرجاع البيانات لاستخدامها في الـ API
  return { 
    success: true, 
    userId, 
    teacherId: user.teacher_profile_id, 
    role: user.role 
  };
}
