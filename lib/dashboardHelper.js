import { supabase } from './supabaseClient';
import { parse } from 'cookie';

/**
 * التحقق من جلسة الداشبورد
 */
export async function verifyDashboardSession(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;

    if (!sessionToken) {
      return { error: 'جلسة غير صالحة', status: 401 };
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, is_blocked, teacher_profile_id, is_admin, admin_username, first_name, session_token')
      .eq('session_token', sessionToken)
      .single();

    if (error || !user) {
      return { error: 'جلسة منتهية أو غير صحيحة', status: 401 };
    }

    if (user.is_blocked) {
      return { error: 'تم تجميد هذا الحساب.', status: 403 };
    }

    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    if (!isSuperAdmin && !isTeacher) {
        return { error: 'غير مصرح لك بدخول لوحة التحكم', status: 403 };
    }

    if (isTeacher && !user.teacher_profile_id) {
       return { error: 'حساب معلم غير مرتبط بملف شخصي', status: 403 };
    }

    // تجهيز كائن المستخدم المدمج
    const enrichedUser = {
        ...user,
        teacherId: user.teacher_profile_id,
        isSuperAdmin: isSuperAdmin,
        name: user.first_name || user.admin_username
    };

    return {
      user: enrichedUser,
      error: null
    };

  } catch (err) {
    console.error("Auth Error:", err.message);
    return { error: 'حدث خطأ داخلي', status: 500 };
  }
}

// ==========================================
// 🛠️ التعديل الجوهري هنا في دوال التصدير 🛠️
// ==========================================

export async function requireSuperAdmin(req, res) {
  const result = await verifyDashboardSession(req);
  
  // 1. في حالة الخطأ: نرسل الرد ونرجع كائن الخطأ لتجنب الانهيار عند التفكيك
  if (result.error) { 
      res.status(result.status).json({ error: result.error }); 
      return { error: result.error, status: result.status }; 
  }
  
  // 2. التحقق الإضافي للصلاحية
  if (!result.user.isSuperAdmin) {
    res.status(403).json({ error: '⛔ غير مصرح (يتطلب صلاحية المدير العام)' });
    return { error: 'Access Denied', status: 403 };
  }

  // 3. النجاح: نرجع النتيجة كما هي ({ user, error: null })
  return result;
}

export async function requireTeacherOrAdmin(req, res) {
  const result = await verifyDashboardSession(req);

  // 1. في حالة الخطأ
  if (result.error) { 
      res.status(result.status).json({ error: result.error }); 
      return { error: result.error, status: result.status }; 
  }

  // 2. النجاح: نرجع النتيجة كما هي ({ user, error: null })
  // هذا يسمح لملفات الـ API بعمل: const { user } = await ...
  return result;
}
