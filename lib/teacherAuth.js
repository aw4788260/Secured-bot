import { supabase } from './supabaseClient';
import jwt from 'jsonwebtoken';

export async function verifyTeacher(req) {
  // console.log("🚀 [verifyTeacher] Starting Dashboard/Teacher Auth...");

  try {
    // 1. استخراج التوكن من الهيدر
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("❌ [verifyTeacher] Missing Authorization Token");
      return { error: 'Missing or Invalid Token', status: 401 };
    }

    const token = authHeader.split(' ')[1];

    // 2. فك التشفير والتحقق من التوقيع (Signature)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("❌ [verifyTeacher] Token Verification Failed:", err.message);
      return { error: 'Invalid or Expired Token', status: 401 };
    }

    const userId = decoded.userId;

    // 3. جلب بيانات المستخدم والتحقق من عمود session_token
    // ⚠️ ملاحظة: تأكد من أن عمود session_token موجود في جدول users في قاعدة البيانات
    const { data: user, error } = await supabase
      .from('users')
      .select('role, teacher_profile_id, is_blocked, session_token')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error("❌ [verifyTeacher] User lookup failed");
      return { error: 'User not found', status: 404 };
    }

    // 4. فحص الحظر
    if (user.is_blocked) {
      console.warn("⛔ [verifyTeacher] User is Blocked");
      return { error: 'Account Blocked', status: 403 };
    }

    // 5. التحقق من جلسة الداشبورد (session_token)
    // هذا يضمن أن التوكن القادم هو أحدث توكن تم إصداره للداشبورد
    // ويختلف عن jwt_token المستخدم في التطبيق
    if (!user.session_token || user.session_token !== token) {
       console.warn(`⛔ [verifyTeacher] Session Mismatch! DB: ${user.session_token?.slice(0,10)}... | Req: ${token.slice(0,10)}...`);
       return { error: 'Session Expired or Invalid (Please Login Again)', status: 401 };
    }

    // 6. التحقق من الصلاحيات (معلم أو مشرف)
    if (user.role !== 'teacher' && user.role !== 'moderator') {
      console.warn(`⛔ [verifyTeacher] Role Mismatch. Found: ${user.role}`);
      return { error: 'Access Denied: Not a teacher account', status: 403 };
    }

    if (!user.teacher_profile_id) {
      console.warn("⚠️ [verifyTeacher] Missing teacher_profile_id");
      return { error: 'No teacher profile linked', status: 400 };
    }

    // console.log(`✅ [verifyTeacher] Success for User: ${userId}`);

    // إرجاع البيانات بنجاح
    return { 
      success: true, 
      userId, 
      teacherId: user.teacher_profile_id, 
      role: user.role 
    };

  } catch (error) {
    console.error(`❌ [verifyTeacher] System Error: ${error.message}`);
    return { error: 'Internal Server Error', status: 500 };
  }
}
