import { supabase } from './supabaseClient';
import { parse } from 'cookie'; // ✅ نحتاج هذه المكتبة لقراءة الكوكيز

export async function verifyTeacher(req) {
  // console.log("🚀 [verifyTeacher] Starting Dashboard Auth (Cookie Mode)...");

  try {
    // 1. قراءة التوكن من الكوكيز (المتوافق مع admin-login.js)
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;
    
    if (!sessionToken) {
      console.error("❌ [verifyTeacher] No Session Cookie found");
      return { error: 'Session expired or invalid', status: 401 };
    }

    // 2. البحث عن المستخدم باستخدام التوكن (session_token)
    // هذا يطابق المنطق في dashboardHelper.js
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, teacher_profile_id, is_blocked, session_token')
      .eq('session_token', sessionToken)
      .single();

    if (error || !user) {
      console.error("❌ [verifyTeacher] Invalid Session Token");
      return { error: 'Invalid Session', status: 401 };
    }

    // 3. فحص الحظر
    if (user.is_blocked) {
      console.warn("⛔ [verifyTeacher] User is Blocked");
      return { error: 'Account Blocked', status: 403 };
    }

    // 4. التحقق من الصلاحيات (معلم أو مشرف)
    // هذا يمنع الطلاب أو المستخدمين العاديين من الوصول للوحة التحكم
    if (user.role !== 'teacher' && user.role !== 'moderator') {
      console.warn(`⛔ [verifyTeacher] Access Denied. Role: ${user.role}`);
      return { error: 'Access Denied: Teachers Only', status: 403 };
    }

    // التأكد من وجود بروفايل معلم
    if (!user.teacher_profile_id) {
      console.warn("⚠️ [verifyTeacher] Missing teacher_profile_id");
      return { error: 'No teacher profile linked', status: 400 };
    }

    // console.log(`✅ [verifyTeacher] Success: ${user.id}`);

    // إرجاع البيانات بنجاح
    return { 
      success: true, 
      userId: user.id, 
      teacherId: user.teacher_profile_id, 
      role: user.role 
    };

  } catch (error) {
    console.error(`❌ [verifyTeacher] System Error: ${error.message}`);
    return { error: 'Internal Server Error', status: 500 };
  }
}
