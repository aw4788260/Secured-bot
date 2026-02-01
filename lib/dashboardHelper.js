import { supabase } from './supabaseClient';
import { parse } from 'cookie';

/**
 * التحقق من جلسة الداشبورد
 * يعتمد على admin_session ويسمح فقط للمعلمين والمشرفين
 */
export async function verifyDashboardSession(req) {
  try {
    // 1. جلب التوكن من الكوكيز
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;

    if (!sessionToken) {
      return { error: 'جلسة غير صالحة', status: 401 };
    }

    // 2. البحث عن المستخدم في جدول users
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, is_blocked, teacher_profile_id, is_admin, admin_username, first_name, session_token')
      .eq('session_token', sessionToken)
      .single();

    if (error || !user) {
      return { error: 'جلسة منتهية أو غير صحيحة', status: 401 };
    }

    // 3. فحص الحظر
    if (user.is_blocked) {
      return { error: 'تم تجميد هذا الحساب.', status: 403 };
    }

    // 4. التحقق من الصلاحيات (Teacher & Super Admin Only)
    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    if (!isSuperAdmin && !isTeacher) {
        return { error: 'غير مصرح لك بدخول لوحة التحكم', status: 403 };
    }

    // تحقق إضافي للمعلمين: يجب أن يكون لديه بروفايل
    if (isTeacher && !user.teacher_profile_id) {
       return { error: 'حساب معلم غير مرتبط بملف شخصي', status: 403 };
    }

    // 5. إرجاع النتيجة
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
    console.error("Dashboard Auth Error:", err.message);
    return { error: 'حدث خطأ داخلي', status: 500 };
  }
}

// الدوال المساعدة للصلاحيات
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
  // التحقق الأساسي تم بالفعل داخل verifyDashboardSession
  return user;
}
