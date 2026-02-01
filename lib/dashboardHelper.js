import { supabase } from './supabaseClient';
import { parse } from 'cookie';

/**
 * التحقق من جلسة الداشبورد
 * يعتمد على admin_session ويسمح فقط للمعلمين والمشرفين
 */
export async function verifyDashboardSession(req) {
  // 1. بداية التحقق
  console.log("🚀 [DashAuth] Starting verification process...");

  try {
    // 2. جلب التوكن من الكوكيز
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;

    if (!sessionToken) {
      console.warn("⚠️ [DashAuth] No 'admin_session' cookie found!");
      return { error: 'جلسة غير صالحة', status: 401 };
    }

    console.log(`🎫 [DashAuth] Token found (Starts with): ${sessionToken.substring(0, 8)}...`);

    // 3. البحث عن المستخدم في جدول users
    console.log("📡 [DashAuth] Querying DB for user with this session_token...");
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, is_blocked, teacher_profile_id, is_admin, admin_username, first_name, session_token')
      .eq('session_token', sessionToken)
      .single();

    // حالة عدم العثور على المستخدم
    if (error || !user) {
      console.error(`❌ [DashAuth] DB Error or User Not Found. Error: ${error?.message}`);
      return { error: 'جلسة منتهية أو غير صحيحة', status: 401 };
    }

    console.log(`👤 [DashAuth] User Found: ID=${user.id} | Role=${user.role} | IsAdmin=${user.is_admin} | Blocked=${user.is_blocked}`);

    // 4. فحص الحظر
    if (user.is_blocked) {
      console.warn(`⛔ [DashAuth] User ${user.id} is BLOCKED.`);
      return { error: 'تم تجميد هذا الحساب.', status: 403 };
    }

    // 5. التحقق من الصلاحيات (Teacher & Super Admin Only)
    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    console.log(`🛡️ [DashAuth] Permission Check -> SuperAdmin: ${isSuperAdmin}, Teacher: ${isTeacher}`);

    if (!isSuperAdmin && !isTeacher) {
        console.warn(`⛔ [DashAuth] Access Denied. User role '${user.role}' is not allowed.`);
        return { error: 'غير مصرح لك بدخول لوحة التحكم', status: 403 };
    }

    // تحقق إضافي للمعلمين: يجب أن يكون لديه بروفايل
    if (isTeacher && !user.teacher_profile_id) {
       console.warn(`⚠️ [DashAuth] Teacher ${user.id} has NO teacher_profile_id.`);
       return { error: 'حساب معلم غير مرتبط بملف شخصي', status: 403 };
    }

    console.log(`✅ [DashAuth] Success! Returning user data for: ${user.admin_username || user.first_name}`);

    // 6. إرجاع النتيجة
    return {
      user: {
        id: user.id,
        username: user.admin_username, // نستخدم اسم الأدمن هنا
        name: user.first_name,
        role: isSuperAdmin ? 'super_admin' : 'teacher',
        isSuperAdmin: isSuperAdmin,
        teacherId: isTeacher ? user.teacher_profile_id : null
      },
      error: null
    };

  } catch (err) {
    console.error("🔥 [DashAuth] EXCEPTION:", err.message);
    return { error: 'حدث خطأ داخلي', status: 500 };
  }
}

// الدوال المساعدة للصلاحيات
export async function requireSuperAdmin(req, res) {
  console.log("🔒 [RequireSuperAdmin] Checking...");
  const { user, error, status } = await verifyDashboardSession(req);
  
  if (error) { 
      console.warn(`❌ [RequireSuperAdmin] Auth Failed: ${error}`);
      res.status(status).json({ error }); 
      return null; 
  }
  
  if (!user.isSuperAdmin) {
    console.warn(`⛔ [RequireSuperAdmin] User ${user.id} is NOT a SuperAdmin.`);
    res.status(403).json({ error: '⛔ غير مصرح (يتطلب صلاحية المدير العام)' });
    return null;
  }

  console.log("✅ [RequireSuperAdmin] Approved.");
  return user;
}

export async function requireTeacherOrAdmin(req, res) {
  console.log("🔒 [RequireTeacherOrAdmin] Checking...");
  const { user, error, status } = await verifyDashboardSession(req);
  
  if (error) { 
      console.warn(`❌ [RequireTeacherOrAdmin] Auth Failed: ${error}`);
      res.status(status).json({ error }); 
      return null; 
  }

  console.log("✅ [RequireTeacherOrAdmin] Approved.");
  // التحقق الأساسي تم بالفعل داخل verifyDashboardSession
  return user;
}
