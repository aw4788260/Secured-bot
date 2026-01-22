import { supabase } from './supabaseClient';
import { checkUserAccess } from './authHelper';

export async function verifyTeacher(req) {
  // 1. التحقق الأساسي (توكن + جهاز) باستخدام الحارس الموجود مسبقاً
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) return { error: 'Unauthorized Device/Token', status: 401 };

  // checkUserAccess يقوم بحقن x-user-id في الهيدر إذا كان التوكن سليم
  const userId = req.headers['x-user-id'];

  // 2. جلب بيانات المستخدم وصلاحيته من قاعدة البيانات
  const { data: user, error } = await supabase
    .from('users')
    .select('role, teacher_profile_id, is_blocked')
    .eq('id', userId)
    .single();

  if (error || !user) return { error: 'User not found', status: 404 };
  if (user.is_blocked) return { error: 'Account Blocked', status: 403 };

  // 3. التحقق من الصلاحية (هل هو معلم أو مشرف؟)
  if (user.role !== 'teacher' && user.role !== 'moderator') {
    return { error: 'Access Denied: Not a teacher account', status: 403 };
  }

  if (!user.teacher_profile_id) {
    return { error: 'No teacher profile linked to this account', status: 400 };
  }

  // إرجاع البيانات لاستخدامها في الـ API
  return { 
    success: true, 
    userId, 
    teacherId: user.teacher_profile_id,
    role: user.role 
  };
}
