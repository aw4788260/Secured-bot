import { supabase } from './supabaseClient';
import { deleteVideoViewLogs } from './videoViewLogsHelper';

// ============================================================
// 🗑️ Shared course/content deep-deletion helpers
// ============================================================
// Extracted from the near-identical logic that used to live separately
// in pages/api/teacher/content.js and pages/api/dashboard/teacher/content.js.
// Both endpoints now import these functions instead of duplicating them,
// and the new scheduled-deletion cron job reuses deepDeleteCourse().
// ============================================================

// 🛠️ Actually delete a video from Bunny Stream's servers.
export async function deleteVideoFromBunny(bunnyVideoId) {
  if (!bunnyVideoId) return;

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;

  if (!libraryId || !apiKey) {
    console.error('⚠️ [Bunny] Missing credentials for deletion');
    return;
  }

  try {
    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey, accept: 'application/json' },
    });

    if (!res.ok) {
      console.error(`⚠️ [Bunny] Failed to delete video ${bunnyVideoId}, status: ${res.status}`);
    } else {
      console.log(`✅ [Bunny] Video ${bunnyVideoId} deleted successfully from Bunny Stream.`);
    }
  } catch (err) {
    console.error('⚠️ [Bunny] Error deleting video:', err.message);
  }
}

// 🎥 Collect every video row (id + bunny_video_id) under a chapter/subject/course,
// used before deleting the parent so we know what to clean up on Bunny + Firestore.
export async function getVideoRowsUnder(type, id) {
  try {
    let chapterIds = [];

    if (type === 'chapters') {
      chapterIds = [id];
    } else if (type === 'subjects') {
      const { data: chapters } = await supabase.from('chapters').select('id').eq('subject_id', id);
      chapterIds = (chapters || []).map(c => c.id);
    } else if (type === 'courses') {
      const { data: subjects } = await supabase.from('subjects').select('id').eq('course_id', id);
      const subjectIds = (subjects || []).map(s => s.id);
      if (subjectIds.length) {
        const { data: chapters } = await supabase.from('chapters').select('id').in('subject_id', subjectIds);
        chapterIds = (chapters || []).map(c => c.id);
      }
    }

    if (!chapterIds.length) return [];

    const { data: videos } = await supabase.from('videos').select('id, bunny_video_id').in('chapter_id', chapterIds);
    return videos || [];
  } catch (e) {
    console.error('⚠️ [Bunny] Failed to collect nested video IDs for cleanup:', e.message);
    return [];
  }
}

// 🛡️ Return only the Bunny IDs that are safe to actually delete from Bunny —
// i.e. no other `videos` row still references them (see "advanced-copy" sharing).
// Must be called AFTER the DB delete so the query reflects post-cascade reality.
export async function getBunnyIdsSafeToDelete(bunnyVideoIds) {
  const uniqueIds = [...new Set((bunnyVideoIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  try {
    const { data: stillReferenced, error } = await supabase
      .from('videos')
      .select('bunny_video_id')
      .in('bunny_video_id', uniqueIds);

    if (error) {
      // Fail safe: delete nothing from Bunny if the check itself fails.
      console.error('⚠️ [Bunny] Shared-video check failed before deletion — skipping all Bunny deletes as a precaution:', error.message);
      return [];
    }

    const stillReferencedIds = new Set((stillReferenced || []).map((v) => v.bunny_video_id));
    const idsToSkip = uniqueIds.filter((vid) => stillReferencedIds.has(vid));
    if (idsToSkip.length > 0) {
      console.log(`ℹ️ [Bunny] Skipping Bunny-delete for ${idsToSkip.length} video(s) still referenced by another row (likely "advanced copy"):`, idsToSkip);
    }

    return uniqueIds.filter((vid) => !stillReferencedIds.has(vid));
  } catch (e) {
    console.error('⚠️ [Bunny] Unexpected error checking shared videos before deletion:', e.message);
    return [];
  }
}

// ============================================================
// 🧨 deepDeleteCourse(courseId)
// ============================================================
// The single entry point for "fully wipe a course": DB cascade delete
// (subjects/chapters/videos/pdfs/exams all go with it via FK cascade),
// safe dedup-checked Bunny video deletion, and video-view-log cleanup.
//
// Used by:
//  - pages/api/teacher/content.js        (action=delete, type=courses)
//  - pages/api/dashboard/teacher/content.js (action=delete, type=courses)
//  - pages/api/cron/scheduled-course-deletion.js (Feature A, superadmin-scheduled)
//
// Returns { success, courseTitle, teacherId } so callers can log/notify.
// Throws on the DB delete itself failing (callers should catch + 500 / log).
// ============================================================
export async function deepDeleteCourse(courseId) {
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, teacher_id')
    .eq('id', courseId)
    .maybeSingle();

  if (!course) {
    return { success: false, error: 'الكورس غير موجود بالفعل (تم حذفه مسبقاً؟).' };
  }

  // 1) Collect every video under this course BEFORE deleting, so we know
  //    what to clean up on Bunny + Firestore once the DB cascade happens.
  const videoRows = await getVideoRowsUnder('courses', courseId);
  const bunnyVideoIdsToDelete = videoRows.map(v => v.bunny_video_id).filter(Boolean);
  const videoIdsToDelete = videoRows.map(v => v.id);

  // 2) Delete the course row itself — DB foreign-key cascades take care of
  //    subjects/chapters/videos/pdfs/exams underneath it.
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;

  // 3) Clean up Bunny Stream, skipping any video ID still referenced by
  //    another row elsewhere (advanced-copy sharing).
  if (bunnyVideoIdsToDelete.length > 0) {
    const idsSafeToDelete = await getBunnyIdsSafeToDelete(bunnyVideoIdsToDelete);
    // Fire-and-forget: don't block the caller's response on Bunny's API.
    idsSafeToDelete.forEach(vid => deleteVideoFromBunny(vid));
  }

  // 4) Clean up orphaned video-view logs in Firestore.
  if (videoIdsToDelete.length > 0) {
    deleteVideoViewLogs(videoIdsToDelete);
  }

  return { success: true, courseTitle: course.title, teacherId: course.teacher_id };
}
