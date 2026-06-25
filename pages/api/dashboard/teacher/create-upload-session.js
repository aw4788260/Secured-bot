import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { supabase } from '../../../../lib/supabaseClient';

// ===================================================================
// 🔑 إنشاء جلسة رفع مباشرة (TUS) من جهاز المعلم إلى Bunny Stream
// ===================================================================
// ✅ ما يفعله هذا الـ API:
//   1) التحقق من صلاحية المعلم وملكيته للفصل (chapter)
//   2) إنشاء كائن فيديو فارغ في Bunny Stream
//   3) إنشاء Presigned TUS Upload URL تُرسل مباشرة للعميل
//   4) الرد بـ (tusUrl + bunny_video_id) فقط — بدون لمس أي بايت من الفيديو
//
// ❌ لا يمر الفيديو بالسيرفر إطلاقاً — يرفعه العميل مباشرة إلى Bunny
// ===================================================================

function getLibraryConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error('متغيرات البيئة الخاصة بـ Bunny Stream غير مكتملة');
  }
  return { libraryId, apiKey };
}

async function verifyChapterOwnership(chapterId, teacherId) {
  if (!chapterId) return false;
  const { data: chapter } = await supabase
    .from('chapters')
    .select('subjects ( courses ( teacher_id ) )')
    .eq('id', chapterId)
    .single();

  const courseTeacherId = chapter?.subjects?.courses?.teacher_id;
  return courseTeacherId && String(courseTeacherId) === String(teacherId);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. التحقق من صلاحية المعلم
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const { chapterId, title, fileSize, expirationHours = 6 } = req.body;

  if (!chapterId) {
    return res.status(400).json({ error: 'chapterId مطلوب' });
  }
  if (!fileSize || fileSize <= 0) {
    return res.status(400).json({ error: 'fileSize مطلوب (بالبايت)' });
  }

  // 2. التحقق من ملكية الفصل
  if (user.role !== 'super_admin') {
    const isOwner = await verifyChapterOwnership(chapterId, user.teacherId);
    if (!isOwner) {
      return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا الفصل.' });
    }
  }

  const { libraryId, apiKey } = getLibraryConfig();
  const videoTitle = title || 'Untitled Video';

  // 3. إنشاء كائن الفيديو في Bunny
  let bunnyVideoId;
  try {
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ title: videoTitle }),
      }
    );
    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`Bunny create video failed: ${createRes.status} — ${errBody}`);
    }
    const createData = await createRes.json();
    bunnyVideoId = createData?.guid;
    if (!bunnyVideoId) throw new Error('لم يتم استلام Video GUID من Bunny');
  } catch (err) {
    console.error('❌ [create-upload-session] Create video error:', err.message);
    return res.status(502).json({ error: 'فشل إنشاء الفيديو على Bunny Stream' });
  }

  // 4. إنشاء Presigned TUS URL (الرفع المباشر)
  //    مدة الصلاحية: expirationHours ساعات من الآن (افتراضي 6 ساعات)
  let tusUploadUrl;
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + expirationHours * 3600;

    const tusRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}/tus`,
      {
        method: 'GET',
        headers: {
          AccessKey: apiKey,
          accept: 'application/json',
          // إرسال حجم الملف و وقت الانتهاء كـ headers مطلوبة من Bunny
          'Upload-Length': String(fileSize),
          'AuthorizationExpire': String(expiresAt),
        },
      }
    );

    if (!tusRes.ok) {
      const errBody = await tusRes.text();
      // تنظيف الفيديو الفاشل من Bunny
      await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
        method: 'DELETE',
        headers: { AccessKey: apiKey },
      }).catch(() => {});
      throw new Error(`Bunny TUS URL failed: ${tusRes.status} — ${errBody}`);
    }

    // Bunny يرجع الـ TUS URL في header "Location"
    tusUploadUrl = tusRes.headers.get('location');
    if (!tusUploadUrl) {
      // بعض إصدارات Bunny ترجعه في الـ body أيضاً
      const tusData = await tusRes.json().catch(() => ({}));
      tusUploadUrl = tusData?.tusUploadUrl || tusData?.location;
    }

    if (!tusUploadUrl) {
      throw new Error('لم يتم استلام TUS Upload URL من Bunny');
    }
  } catch (err) {
    console.error('❌ [create-upload-session] TUS URL error:', err.message);
    return res.status(502).json({ error: `فشل إنشاء رابط الرفع المباشر: ${err.message}` });
  }

  console.log(`✅ [create-upload-session] TUS session created. videoId=${bunnyVideoId}`);

  // 5. الرد بالبيانات المطلوبة للعميل لبدء الرفع المباشر
  return res.status(200).json({
    success: true,
    bunnyVideoId,      // سيُستخدم لاحقاً لربط الفيديو بالـ chapter في DB
    tusUploadUrl,      // العميل يرفع إليه مباشرة باستخدام tus-js-client
    chapterId,
    title: videoTitle,
  });
}
