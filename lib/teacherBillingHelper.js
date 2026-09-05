import { supabase } from './supabaseClient';

// ============================================================
// 💰 Teacher billing helper (Multi-Method Teacher Billing)
// ============================================================
// Single source of truth for "how much does the platform take from this
// teacher's sales". Every report endpoint (finance overview, single-teacher
// report, teacher-facing earnings widgets) should call
// computeTeacherBilling() instead of re-implementing the math or calling
// the old opaque `get_teacher_revenue` / `get_teacher_actual_revenue` RPCs
// directly — those RPCs only knew about the old flat-percentage model.
//
// A teacher's `teachers.billing_method` decides which of the 3 methods is
// used for that teacher's ENTIRE requested date range (no versioning —
// see README note in the plan if that's ever needed):
//
//   percentage    -> platform_fee = sum(actual_paid_price ?? total_price)
//                    over approved requests * effective percentage
//                    (teachers.custom_percentage, else the global
//                    app_settings.platform_percentage)
//
//   new_student   -> platform_fee = (# approved requests whose student was
//                    NEW to this teacher at the time of that request)
//                    * teachers.new_student_price
//
//   course_price  -> platform_fee = sum, over every item in every approved
//                    request, of that item's `report_price` (subject
//                    override -> course fallback -> 0/unpriced)
//
// In every case: platform_fee is subtracted from the actual amount
// collected to get the teacher's net_profit — this mirrors how the old
// percentage-only math worked, so the finance dashboard's existing
// "platform fee / net profit" columns keep meaning the same thing for all
// three methods (see the "one assumption to confirm" note in the plan;
// flip the subtraction here in ONE place if that assumption turns out to
// be wrong instead of touching every consumer).
// ============================================================

const VALID_BILLING_METHODS = ['percentage', 'new_student', 'course_price'];

// ------------------------------------------------------------
// Small money/amount helpers
// ------------------------------------------------------------

// A request's "actual" amount is the admin-edited actual_paid_price when
// set, else falls back to the originally requested total_price.
function actualAmountOf(request) {
  const val = request?.actual_paid_price;
  if (val === null || val === undefined) return Number(request?.total_price) || 0;
  return Number(val) || 0;
}

function originalAmountOf(request) {
  return Number(request?.total_price) || 0;
}

// ------------------------------------------------------------
// Global % (existing logic, moved here so it's read from one place)
// ------------------------------------------------------------

/**
 * @returns {Promise<number>} platform percentage as a 0-1 fraction (e.g. 0.10 for 10%)
 */
export async function getGlobalPlatformPercentage() {
  let percentage = 0.10; // default 10%

  const { data: settingsData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'platform_percentage')
    .maybeSingle();

  if (settingsData && settingsData.value) {
    const val = parseFloat(settingsData.value);
    if (!isNaN(val)) {
      // نفس المنطق القديم: لو الرقم أكبر من 1 (مثل 15) نقسمه على 100
      percentage = val > 1 ? val / 100 : val;
    }
  }

  return percentage;
}

/**
 * Resolve the % that should apply to a teacher on billing_method='percentage':
 * their own custom_percentage override if set, else the global setting.
 * @param {{ custom_percentage?: number|null }} teacher
 * @returns {Promise<number>} 0-1 fraction
 */
export async function resolveEffectivePercentage(teacher) {
  if (teacher && teacher.custom_percentage !== null && teacher.custom_percentage !== undefined) {
    const custom = Number(teacher.custom_percentage);
    if (Number.isFinite(custom)) {
      // custom_percentage is stored 0-100 (validated at write time), not 0-1
      return custom / 100;
    }
  }
  return await getGlobalPlatformPercentage();
}

// ------------------------------------------------------------
// "New student" check (billing_method = 'new_student')
// ------------------------------------------------------------

/**
 * Was this student NEW to this teacher as of `beforeTimestamp`?
 * "New" = no earlier APPROVED request from the same student with the same
 * teacher. Always evaluated against the request's OWN created_at (passed
 * in as beforeTimestamp) rather than "now", so re-running a report for a
 * past period gives the same answer even after later subscriptions happen.
 *
 * Matches students by user_username (always present & unique), not
 * user_id, since user_id can be null until a request is approved.
 *
 * @param {string} userUsername
 * @param {number|string} teacherId - teacher_profile_id / teachers.id
 * @param {string} beforeTimestamp - ISO timestamp, exclusive upper bound
 * @returns {Promise<boolean>}
 */
export async function isNewStudentForTeacher(userUsername, teacherId, beforeTimestamp) {
  if (!userUsername || !teacherId || !beforeTimestamp) return true;

  const { count, error } = await supabase
    .from('subscription_requests')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('user_username', userUsername)
    .eq('status', 'approved')
    .lt('created_at', beforeTimestamp);

  if (error) {
    console.error('⚠️ [teacherBillingHelper] isNewStudentForTeacher failed:', error.message);
    // Fail safe: don't silently under-charge/over-charge on an error —
    // treat as "not new" so it doesn't inflate the new-student count.
    return false;
  }

  return (count || 0) === 0;
}

// ------------------------------------------------------------
// Report-price lookup (billing_method = 'course_price')
// ------------------------------------------------------------

/**
 * Batch-fetch report_price for a set of courses/subjects and return a
 * small resolver so each requested_data item's price can be looked up:
 * subject-level override -> parent course's price -> null (unpriced).
 *
 * @param {Array<number|string>} courseIds
 * @param {Array<number|string>} subjectIds
 * @returns {Promise<{
 *   resolvePrice: (item: {type: 'course'|'subject', id: number|string}) => number|null,
 *   courseReportPrice: Map<any, number|null>,
 *   subjectMeta: Map<any, { report_price: number|null, course_id: any }>
 * }>}
 */
export async function getReportPriceMap(courseIds = [], subjectIds = []) {
  const uniqueCourseIds = [...new Set(courseIds.filter(id => id !== null && id !== undefined))];
  const uniqueSubjectIds = [...new Set(subjectIds.filter(id => id !== null && id !== undefined))];

  const [{ data: courses, error: coursesError }, { data: subjects, error: subjectsError }] = await Promise.all([
    uniqueCourseIds.length
      ? supabase.from('courses').select('id, report_price').in('id', uniqueCourseIds)
      : Promise.resolve({ data: [] }),
    uniqueSubjectIds.length
      ? supabase.from('subjects').select('id, course_id, report_price').in('id', uniqueSubjectIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (coursesError) throw coursesError;
  if (subjectsError) throw subjectsError;

  const courseReportPrice = new Map((courses || []).map(c => [c.id, c.report_price ?? null]));
  const subjectMeta = new Map((subjects || []).map(s => [s.id, { report_price: s.report_price ?? null, course_id: s.course_id }]));

  function resolvePrice(item) {
    if (!item) return null;

    if (item.type === 'course') {
      return courseReportPrice.has(item.id) ? courseReportPrice.get(item.id) : null;
    }

    if (item.type === 'subject') {
      const meta = subjectMeta.get(item.id);
      if (!meta) return null;
      if (meta.report_price !== null && meta.report_price !== undefined) return meta.report_price;
      // لا يوجد سعر خاص بالمادة -> نرجع لسعر الكورس الأب (إن وجد)
      return courseReportPrice.has(meta.course_id) ? courseReportPrice.get(meta.course_id) : null;
    }

    return null;
  }

  return { resolvePrice, courseReportPrice, subjectMeta };
}

// ------------------------------------------------------------
// Main entry point
// ------------------------------------------------------------

function emptyBillingResult(billingMethod = 'percentage') {
  return {
    requests: [],
    original_amount: 0,
    actual_amount: 0,
    platform_fee: 0,
    net_profit: 0,
    billing_method: billingMethod,
    meta: { approved_count: 0, rejected_count: 0 },
  };
}

/**
 * Compute a teacher's billing for a date range, using whichever
 * billing_method that teacher is currently set to.
 *
 * @param {number|string} teacherProfileId - teachers.id (aka teacher_profile_id on users, teacher_id on subscription_requests)
 * @param {string|null} [startDate] - ISO timestamp (inclusive). Pass an
 *   already-timezone-resolved UTC boundary, same as callers currently pass
 *   to the old RPCs (see getUtcBoundary() in finance.js/teacher-report.js).
 * @param {string|null} [endDate] - ISO timestamp (inclusive)
 * @returns {Promise<{
 *   requests: Array<object>,
 *   original_amount: number,
 *   actual_amount: number,
 *   platform_fee: number,
 *   net_profit: number,
 *   billing_method: string,
 *   meta: object
 * }>}
 */
export async function computeTeacherBilling(teacherProfileId, startDate = null, endDate = null) {
  if (!teacherProfileId) return emptyBillingResult();

  // 1) Load the teacher's billing configuration.
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('id, billing_method, custom_percentage, new_student_price')
    .eq('id', teacherProfileId)
    .maybeSingle();
  if (teacherError) throw teacherError;

  const billingMethod = VALID_BILLING_METHODS.includes(teacher?.billing_method)
    ? teacher.billing_method
    : 'percentage';

  // 2) Load approved + rejected requests in range (rejected kept only for counts).
  let query = supabase
    .from('subscription_requests')
    .select('*')
    .eq('teacher_id', teacherProfileId)
    .in('status', ['approved', 'rejected'])
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data: requests, error: requestsError } = await query;
  if (requestsError) throw requestsError;

  const approvedRequests = (requests || []).filter(r => r.status === 'approved');
  const rejectedCount = (requests || []).length - approvedRequests.length;

  // "Sales" totals are computed the same way regardless of billing method —
  // only how the platform_fee is derived from them changes below.
  const originalAmount = approvedRequests.reduce((sum, r) => sum + originalAmountOf(r), 0);
  const actualAmount = approvedRequests.reduce((sum, r) => sum + actualAmountOf(r), 0);

  let platformFee = 0;
  let meta = { approved_count: approvedRequests.length, rejected_count: rejectedCount };

  if (billingMethod === 'new_student') {
    // ----- Method 2: fixed fee per NEW student -----
    const newStudentPrice = Number(teacher?.new_student_price) || 0;
    const perRequest = [];
    let newStudentCount = 0;

    for (const request of approvedRequests) {
      const isNew = await isNewStudentForTeacher(request.user_username, teacherProfileId, request.created_at);
      if (isNew) newStudentCount += 1;
      perRequest.push({ request_id: request.id, is_new_student: isNew });
    }

    platformFee = newStudentCount * newStudentPrice;
    meta = {
      ...meta,
      new_student_price: newStudentPrice,
      new_student_count: newStudentCount,
      per_request: perRequest,
    };
  } else if (billingMethod === 'course_price') {
    // ----- Method 3: fixed report price per requested item -----
    const allItems = approvedRequests.flatMap(r => r.requested_data || []);
    const courseIds = allItems.filter(i => i.type === 'course').map(i => i.id);
    const subjectIds = allItems.filter(i => i.type === 'subject').map(i => i.id);

    const { resolvePrice } = await getReportPriceMap(courseIds, subjectIds);

    let unpricedItemsCount = 0;
    const perRequest = approvedRequests.map(request => {
      const items = (request.requested_data || []).map(item => {
        const appliedPrice = resolvePrice(item);
        if (appliedPrice === null) unpricedItemsCount += 1;
        const priceToApply = appliedPrice || 0;
        platformFee += priceToApply;
        return { id: item.id, type: item.type, title: item.title, applied_report_price: appliedPrice };
      });
      return { request_id: request.id, items };
    });

    meta = {
      ...meta,
      unpriced_items_count: unpricedItemsCount,
      per_request: perRequest,
    };
  } else {
    // ----- Method 1 (default): flat/custom percentage -----
    const effectivePercentage = await resolveEffectivePercentage(teacher);
    platformFee = actualAmount * effectivePercentage;
    meta = { ...meta, effective_percentage: effectivePercentage };
  }

  const netProfit = actualAmount - platformFee;

  return {
    requests: requests || [],
    original_amount: originalAmount,
    actual_amount: actualAmount,
    platform_fee: platformFee,
    net_profit: netProfit,
    billing_method: billingMethod,
    meta,
  };
}

export { VALID_BILLING_METHODS };
