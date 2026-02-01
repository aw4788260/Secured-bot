import { supabase } from './supabaseClient';
import { parse } from 'cookie';

/**
 * دالة التحقق من جلسة لوحة التحكم (Dashboard)
 * @param {Object} req - طلب الـ API
 * @returns {Object} { user, error, status }
 */
export async function verifyDashboardSession(req) {
  try {
    // 1. جلب التوكن من الكوكيز
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;

    if (!sessionToken) {
      return { error: 'جلسة غير صالحة (No Token)', status: 401 };
    }

    // 2. البحث عن المستخدم في قاعدة البيانات باستخدام التوكن
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, is_blocked, teacher_profile_id, is_admin, username, first_name')
      .eq('session_token', sessionToken)
      .single();

    if (error || !user) {
      return { error: 'جلسة منتهية أو غير صحيحة', status: 401 };
    }

    // 3. التحقق من الحظر
    if (user.is_blocked) {
      return { error: 'تم تجميد هذا الحساب. تواصل مع الإدارة.', status: 403 };
    }

    // 4. توحيد وتصنيف الصلاحيات (Normalization)
    // نعتبر المستخدم Super Admin إذا كان admin=true أو role='super_admin'
    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';

    // 5. إرجاع كائن المستخدم "المنظف" والمجهز
    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.first_name,
        role: isSuperAdmin ? 'super_admin' : (isTeacher ? 'teacher' : 'viewer'),
        isSuperAdmin: isSuperAdmin,
        // إذا كان مدرساً، نرجع رقم البروفايل الخاص به، وإلا null
        teacherId: isTeacher ? user.teacher_profile_id : null 
      },
      error: null
    };

  } catch (err) {
    console.error("Dashboard Auth Error:", err.message);
    return { error: 'حدث خطأ داخلي أثناء التحقق', status: 500 };
  }
}

/**
 * دالة مساعدة لحماية API يتطلب صلاحية "سوبر أدمن" فقط
 */
export async function requireSuperAdmin(req, res) {
  const { user, error, status } = await verifyDashboardSession(req);
  
  if (error) {
    res.status(status).json({ error });
    return null; // لإيقاف التنفيذ
  }

  if (!user.isSuperAdmin) {
    res.status(403).json({ error: '⛔ غير مصرح (يتطلب صلاحية المدير العام)' });
    return null;
  }

  return user;
}

/**
 * دالة مساعدة لحماية API يتطلب صلاحية "مدرس" أو "سوبر أدمن"
 */
export async function requireTeacherOrAdmin(req, res) {
  const { user, error, status } = await verifyDashboardSession(req);
  
  if (error) {
    res.status(status).json({ error });
    return null;
  }

  // السماح إذا كان مدرس يملك بروفايل أو سوبر أدمن
  if (!user.isSuperAdmin && (!user.teacherId)) {
    res.status(403).json({ error: '⛔ غير مصرح (حساب مدرس غير مرتبط بملف شخصي)' });
    return null;
  }

  return user;
}
