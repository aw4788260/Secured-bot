import { supabase } from './supabaseClient';

// ============================================================
// ⏳ Access-expiry helper (Feature B: per-student access duration)
// ============================================================
// Used by every backend endpoint that grants a student access to a
// course or a single subject (approve request, grant access, free
// enroll...). It resolves the duration that should apply to a NEW
// grant and turns it into a concrete expires_at timestamp.
//
// Precedence: subject-level override -> course-level default -> null
// (lifetime access, current behaviour, unchanged).
//
// IMPORTANT: this must be called at GRANT time only. It must never be
// re-applied to existing rows — existing students keep whatever
// expires_at (or NULL/lifetime) they already had. Superadmin changing
// a course/subject's access_duration_days only affects *future* grants.
// ============================================================

/**
 * Resolve how many days of access a NEW grant should get.
 * @param {number|string} courseId
 * @param {number|string|null} subjectId - pass null/undefined for a course-wide grant
 * @returns {Promise<number|null>} duration in days, or null for lifetime access
 */
export async function resolveAccessDurationDays(courseId, subjectId = null) {
  try {
    if (subjectId) {
      const { data: subject } = await supabase
        .from('subjects')
        .select('access_duration_days, course_id')
        .eq('id', subjectId)
        .maybeSingle();

      if (subject && subject.access_duration_days !== null && subject.access_duration_days !== undefined) {
        return subject.access_duration_days;
      }

      // No subject-level override -> fall back to the subject's own parent course
      const effectiveCourseId = courseId || subject?.course_id;
      if (effectiveCourseId) {
        return await getCourseAccessDurationDays(effectiveCourseId);
      }
      return null;
    }

    if (courseId) {
      return await getCourseAccessDurationDays(courseId);
    }

    return null;
  } catch (e) {
    // Fail safe: never block a grant because of an expiry-lookup error.
    // Worst case a student gets lifetime access instead of a timed one,
    // which a superadmin can still correct manually.
    console.error('⚠️ [AccessExpiry] Failed to resolve access duration:', e.message);
    return null;
  }
}

async function getCourseAccessDurationDays(courseId) {
  const { data: course } = await supabase
    .from('courses')
    .select('access_duration_days')
    .eq('id', courseId)
    .maybeSingle();

  return course && course.access_duration_days !== null && course.access_duration_days !== undefined
    ? course.access_duration_days
    : null;
}

/**
 * Turn a duration (days) into a concrete ISO timestamp starting now.
 * @param {number|null} durationDays
 * @returns {string|null} ISO timestamp, or null for lifetime access
 */
export function computeExpiresAt(durationDays) {
  if (durationDays === null || durationDays === undefined) return null;
  const days = Number(durationDays);
  if (!Number.isFinite(days) || days <= 0) return null;

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

/**
 * Convenience: resolve + compute in one call, for grant sites that just
 * want a ready-to-insert { granted_at, expires_at } pair.
 * @param {number|string} courseId
 * @param {number|string|null} subjectId
 */
export async function buildGrantTimestamps(courseId, subjectId = null) {
  const durationDays = await resolveAccessDurationDays(courseId, subjectId);
  return {
    granted_at: new Date().toISOString(),
    expires_at: computeExpiresAt(durationDays),
  };
}

/**
 * Build a Supabase `.or()` filter string for "access is currently active":
 * expires_at is null (lifetime) OR expires_at is in the future.
 * Kept here so every read/enforce site applies the exact same rule.
 * Must be generated fresh at query time (bakes in the current timestamp).
 *
 * Usage: query.or(buildActiveAccessFilter())
 */
export function buildActiveAccessFilter() {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}

/**
 * True/false check for a single already-fetched access row.
 * @param {{ expires_at?: string|null }} row
 */
export function isAccessRowActive(row) {
  if (!row) return false;
  if (!row.expires_at) return true; // lifetime access
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Teachers and moderators must never be locked out by an access-expiry
 * timer meant for paying students — even if the course/subject they're
 * granted (e.g. to preview their own content, or a colleague's) has a
 * configured access_duration_days. Always treat these roles as lifetime.
 * @param {string|null|undefined} role
 */
export function isExemptFromExpiry(role) {
  return role === 'teacher' || role === 'moderator';
}
