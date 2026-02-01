import { supabase } from './supabaseClient';
import { parse } from 'cookie';

/**
 * التحقق من جلسة الداشبورد
 */
export async function verifyDashboardSession(req) {
  // console.log("🚀 [DashAuth] Starting verification...");

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

    // ✅ التعديل هنا: إرجاع المستخدم الأصلي مدموجاً مع الخصائص الجديدة
    // هذا يضمن أن user.teacher_profile_id و user.is_admin متاحة للصفحات القديمة
    const enrichedUser = {
        ...user, // نسخ كل حقول قاعدة البيانات كما هي
        teacherId: user.teacher_profile_id, // توفير الاسم الجديد أيضاً
        isSuperAdmin: isSuperAdmin,         // توفير الخاصية المحسوبة
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

// الدوال المساعدة (بدون تغيير، ستعمل الآن بشكل صحيح)
export async function requireSuperAdmin(req, res) {
  const { user, error, status } = await verifyDashboardSession(req);
  if (error) { res.status(status).json({ error }); return null; }
  
  if (!user.isSuperAdmin) {
    res.status(403).json({ error: '⛔ غير مصرح (يتطلب صلاحية المدير العام)' });
    return null;
  }
  return user;
}

export async function requireTeacherOrAdmin(req, res) {
  const { user, error, status } = await verifyDashboardSession(req);
  if (error) { res.status(status).json({ error }); return null; }
  return user;
}
