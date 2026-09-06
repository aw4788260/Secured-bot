import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { getTeacherPermissions, DEFAULT_TEACHER_PERMISSIONS } from '../../../../lib/teacherPermissions';

// ===================================================================
// 📋 [Teacher Dashboard] جلب صلاحيات المعلم الحالي (رفع PDF / فيديو / امتحانات)
// ===================================================================
// تستخدمها واجهة لوحة تحكم المعلم لتحديد أي أزرار/ميزات يجب إخفاؤها أو تعطيلها.
// السوبر أدمن يرى دائماً كل الصلاحيات مفعّلة (لا قيود عليه في لوحة المعلم أصلاً).
// ===================================================================

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (user.role === 'super_admin') {
      return res.status(200).json({ success: true, permissions: { ...DEFAULT_TEACHER_PERMISSIONS } });
    }

    const permissions = await getTeacherPermissions(user.teacherId);
    return res.status(200).json({ success: true, permissions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
