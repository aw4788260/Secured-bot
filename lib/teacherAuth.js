import { supabase } from './supabaseClient';
import { checkUserAccess } from './authHelper';

export async function verifyTeacher(req) {
  console.log("🚀 [verifyTeacher] Starting verification process...");

  // 1. التحقق الأساسي (توكن + جهاز)
  console.log("🔍 [verifyTeacher] Step 1: Calling checkUserAccess...");
  const isAuthorized = await checkUserAccess(req);
  console.log(`ℹ️ [verifyTeacher] checkUserAccess result: ${isAuthorized}`);

  if (!isAuthorized) {
    console.error("❌ [verifyTeacher] Failed: Unauthorized Device/Token");
    return { error: 'Unauthorized Device/Token', status: 401 };
  }

  // استخراج الـ ID
  const userId = req.headers['x-user-id'];
  console.log(`🆔 [verifyTeacher] Extracted x-user-id from headers: ${userId}`);

  if (!userId) {
    console.error("❌ [verifyTeacher] Failed: User ID is missing in headers");
    return { error: 'User ID missing', status: 400 };
  }

  // 2. جلب بيانات المستخدم
  console.log("🔍 [verifyTeacher] Step 2: Querying Supabase for user details...");
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
    console.error("❌ [verifyTeacher] Failed: User not found in DB");
    return { error: 'User not found', status: 404 };
  }

  console.log("📄 [verifyTeacher] User Data Retrieved:", user);

  if (user.is_blocked) {
    console.warn("⛔ [verifyTeacher] Failed: User account is blocked");
    return { error: 'Account Blocked', status: 403 };
  }

  // 3. التحقق من الصلاحية
  console.log(`⚖️ [verifyTeacher] Step 3: Checking Role (Current: ${user.role})`);

  if (user.role !== 'teacher' && user.role !== 'moderator') {
    console.warn(`⛔ [verifyTeacher] Failed: Invalid Role. Expected teacher/moderator, got '${user.role}'`);
    return { error: 'Access Denied: Not a teacher account', status: 403 };
  }

  if (!user.teacher_profile_id) {
    console.warn("⚠️ [verifyTeacher] Failed: No teacher_profile_id linked to this account");
    return { error: 'No teacher profile linked to this account', status: 400 };
  }

  console.log(`✅ [verifyTeacher] Success! Teacher verified. (TeacherID: ${user.teacher_profile_id})`);

  // إرجاع البيانات
  return { 
    success: true, 
    userId, 
    teacherId: user.teacher_profile_id,
    role: user.role 
  };
}
