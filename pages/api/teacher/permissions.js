import { verifyTeacher } from '../../../lib/teacherAuth';
import { getTeacherPermissions } from '../../../lib/teacherPermissions';

// ===================================================================
// 📱 [APP] جلب صلاحيات المعلم الحالي (رفع PDF / فيديو / امتحانات)
// ===================================================================
// نفس منطق /api/dashboard/teacher/permissions.js الخاص بلوحة التحكم على
// الويب، لكنه يستخدم verifyTeacher (مصادقة Bearer Token) بدلاً من جلسة
// الكوكيز. يستخدمها تطبيق المعلم لتحديد أي أزرار/ميزات يجب إخفاؤها أو
// تعطيلها (رفع فيديو، رفع PDF، إنشاء/تعديل امتحان).
// ===================================================================

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = await verifyTeacher(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const permissions = await getTeacherPermissions(auth.teacherId);
    return res.status(200).json({ success: true, permissions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
