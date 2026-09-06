import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';
import {
  DEFAULT_TEACHER_PERMISSIONS,
  sanitizePermissionsInput,
} from '../../../../lib/teacherPermissions';

// ===================================================================
// 🛡️ [Super Admin] عرض/تعديل صلاحيات معلم معيّن (رفع PDF / فيديو / امتحانات)
// ===================================================================
// GET  ?teacherId=123  → يُرجع الصلاحيات الحالية (مدمجة مع الافتراضي)
// PUT  { teacherId, permissions: { can_upload_pdf, can_upload_video, can_create_exam } }
//      → يحفظ الصلاحيات الجديدة (بعد تنظيفها) في عمود teachers.permissions
// ===================================================================

export default async (req, res) => {
  // التحقق من الصلاحية (سوبر أدمن فقط)
  const { error } = await requireSuperAdmin(req, res);
  if (error) return;

  if (req.method === 'GET') {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'معرف المعلم مطلوب' });

    try {
      const { data, error: fetchError } = await supabase
        .from('teachers')
        .select('id, name, permissions')
        .eq('id', teacherId)
        .single();

      if (fetchError) throw fetchError;

      return res.status(200).json({
        success: true,
        teacherId: data.id,
        name: data.name,
        permissions: { ...DEFAULT_TEACHER_PERMISSIONS, ...(data.permissions || {}) },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PUT') {
    const { teacherId, permissions } = req.body || {};
    if (!teacherId) return res.status(400).json({ error: 'معرف المعلم مطلوب' });

    // ننطلق من الافتراضي (كل شيء true) وندمج فوقه فقط المفاتيح المعروفة/الصحيحة المُرسلة
    const cleanPermissions = {
      ...DEFAULT_TEACHER_PERMISSIONS,
      ...sanitizePermissionsInput(permissions),
    };

    try {
      const { data, error: updateError } = await supabase
        .from('teachers')
        .update({ permissions: cleanPermissions })
        .eq('id', teacherId)
        .select('id, permissions')
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({ success: true, permissions: data.permissions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
