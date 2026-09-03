// pages/api/dashboard/super/courses.js
// ============================================================
// 🗂️ Superadmin: Courses management (Step 8)
// ============================================================
// GET  -> lists every course (all teachers) with its subjects, the
//         teacher's name, active-student counts, and the two policy
//         fields set by the superadmin:
//           - scheduled_deletion_at (Feature A)
//           - access_duration_days (course + per-subject override, Feature B)
//
// POST -> two actions:
//   { action: 'set_scheduled_deletion', courseId, scheduledDeletionAt }
//     scheduledDeletionAt: ISO string (future) to (re)schedule, or null to cancel.
//     Does NOT delete anything itself — pages/api/cron/scheduled-course-deletion.js
//     picks it up and calls deepDeleteCourse() once the date arrives.
//
//   { action: 'set_access_duration', courseId, subjectId, durationDays }
//     subjectId null/undefined -> sets the course-level default.
//     subjectId present -> sets that subject's override only.
//     durationDays: positive integer (days), or null for "lifetime".
//     IMPORTANT: this only affects *future* grants — lib/accessExpiryHelper.js
//     resolves it at grant time. Existing students' expires_at is untouched.
// ============================================================

import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';
import { isAccessRowActive } from '../../../../lib/accessExpiryHelper';

export default async function handler(req, res) {
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return;

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);

  return res.status(405).json({ error: 'Method not allowed' });
}

// ============================================================
// GET
// ============================================================
async function handleGet(req, res) {
  try {
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, title, teacher_id, scheduled_deletion_at, access_duration_days, created_at')
      .order('created_at', { ascending: false });
    if (coursesError) throw coursesError;

    const courseIds = (courses || []).map(c => c.id);

    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, title, course_id, access_duration_days')
      .in('course_id', courseIds.length ? courseIds : [-1]);
    if (subjectsError) throw subjectsError;

    const teacherIds = [...new Set((courses || []).map(c => c.teacher_id).filter(Boolean))];
    const { data: teachers } = teacherIds.length
      ? await supabase.from('teachers').select('id, name').in('id', teacherIds)
      : { data: [] };
    const teacherNameById = new Map((teachers || []).map(t => [t.id, t.name]));

    // Active-student counts per course/subject (expiry-aware, same rule as
    // everywhere else — see lib/accessExpiryHelper.js).
    const [courseAccessRows, subjectAccessRows] = await Promise.all([
      courseIds.length
        ? supabase.from('user_course_access').select('course_id, expires_at').in('course_id', courseIds)
        : { data: [] },
      subjects.length
        ? supabase.from('user_subject_access').select('subject_id, expires_at').in('subject_id', subjects.map(s => s.id))
        : { data: [] },
    ]);

    const activeCountByCourse = new Map();
    for (const row of courseAccessRows.data || []) {
      if (!isAccessRowActive(row)) continue;
      activeCountByCourse.set(row.course_id, (activeCountByCourse.get(row.course_id) || 0) + 1);
    }
    const activeCountBySubject = new Map();
    for (const row of subjectAccessRows.data || []) {
      if (!isAccessRowActive(row)) continue;
      activeCountBySubject.set(row.subject_id, (activeCountBySubject.get(row.subject_id) || 0) + 1);
    }

    const structured = (courses || []).map(course => {
      const courseSubjects = (subjects || [])
        .filter(s => s.course_id === course.id)
        .map(s => ({
          id: s.id,
          title: s.title,
          access_duration_days: s.access_duration_days,
          active_students: activeCountBySubject.get(s.id) || 0,
        }));

      return {
        id: course.id,
        title: course.title,
        teacher_id: course.teacher_id,
        teacher_name: teacherNameById.get(course.teacher_id) || '—',
        created_at: course.created_at,
        scheduled_deletion_at: course.scheduled_deletion_at,
        access_duration_days: course.access_duration_days,
        active_students: activeCountByCourse.get(course.id) || 0,
        subjects: courseSubjects,
      };
    });

    return res.status(200).json({ courses: structured });
  } catch (error) {
    console.error('❌ [dashboard/super/courses][GET]', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// POST — policy actions
// ============================================================
async function handlePost(req, res) {
  const { action } = req.body || {};

  try {
    if (action === 'set_scheduled_deletion') {
      return await setScheduledDeletion(req, res);
    }
    if (action === 'set_access_duration') {
      return await setAccessDuration(req, res);
    }
    return res.status(400).json({ error: 'إجراء غير معروف (action)' });
  } catch (error) {
    console.error('❌ [dashboard/super/courses][POST]', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function setScheduledDeletion(req, res) {
  const { courseId, scheduledDeletionAt } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'courseId مطلوب' });

  let value = null;
  if (scheduledDeletionAt) {
    const parsed = new Date(scheduledDeletionAt);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'تاريخ غير صالح' });
    }
    if (parsed.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'يجب أن يكون تاريخ الحذف في المستقبل' });
    }
    value = parsed.toISOString();
  }

  const { data, error } = await supabase
    .from('courses')
    .update({ scheduled_deletion_at: value })
    .eq('id', courseId)
    .select('id, title, scheduled_deletion_at')
    .maybeSingle();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'الكورس غير موجود' });

  return res.status(200).json({
    success: true,
    message: value ? `تم جدولة حذف "${data.title}" بتاريخ ${value}` : `تم إلغاء جدولة حذف "${data.title}"`,
    course: data,
  });
}

async function setAccessDuration(req, res) {
  const { courseId, subjectId, durationDays } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'courseId مطلوب' });

  let value = null;
  if (durationDays !== null && durationDays !== undefined && durationDays !== '') {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ error: 'عدد الأيام يجب أن يكون رقماً موجباً' });
    }
    value = Math.round(days);
  }

  const table = subjectId ? 'subjects' : 'courses';
  const targetId = subjectId || courseId;

  // Sanity check: a subject override must actually belong to the given course.
  if (subjectId) {
    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, course_id')
      .eq('id', subjectId)
      .maybeSingle();
    if (!subjectRow || subjectRow.course_id !== Number(courseId)) {
      return res.status(400).json({ error: 'المادة لا تنتمي لهذا الكورس' });
    }
  }

  const { data, error } = await supabase
    .from(table)
    .update({ access_duration_days: value })
    .eq('id', targetId)
    .select('id, title, access_duration_days')
    .maybeSingle();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'غير موجود' });

  return res.status(200).json({
    success: true,
    message: value
      ? `تم ضبط مدة الوصول لـ "${data.title}" إلى ${value} يوم (يسري على المنح الجديدة فقط)`
      : `تم ضبط "${data.title}" على وصول مدى الحياة (يسري على المنح الجديدة فقط)`,
    item: data,
  });
}
