import crypto from 'crypto';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { supabase } from '../../../../lib/supabaseClient';

// ===================================================================
// 🔑 إنشاء جلسة رفع مباشرة (TUS) من جهاز المعلم إلى Bunny Stream
// ===================================================================
// ✅ ما يفعله هذا الـ API:
//   1) التحقق من صلاحية المعلم وملكيته للفصل (chapter)
//   2) إنشاء كائن فيديو فارغ في Bunny Stream
//   3) إنشاء توقيع أمني (Signature) للرفع المباشر
//   4) الرد بـ (signature + بيانات التوثيق) فقط — بدون لمس أي بايت من الفيديو
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
    return res.status(502).json({ error: 'فشل إنشاء الفيديو على السيرفر' });
  }

  // 4. إنشاء توقيع (Signature) للرفع المباشر الموثق من Bunny
  let signature;
  let expiresAt;
  try {
    // تحديد وقت انتهاء الصلاحية
    expiresAt = Math.floor(Date.now() / 1000) + expirationHours * 3600;

    // إنشاء التوقيع بالترتيب المطلوب: library_id + api_key + expiration_time + video_id
    const signatureString = `${libraryId}${apiKey}${expiresAt}${bunnyVideoId}`;
    signature = crypto.createHash('sha256').update(signatureString).digest('hex');

  } catch (err) {
    console.error('❌ [create-upload-session] Signature error:', err.message);
    // تنظيف الفيديو الفاشل من Bunny لتجنب بقاء ملفات فارغة
    await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey },
    }).catch(() => {});
    return res.status(502).json({ error: `فشل إنشاء توقيع الرفع: ${err.message}` });
  }

  console.log(`✅ [create-upload-session] TUS session created. videoId=${bunnyVideoId}`);

  // 5. الرد بالبيانات المطلوبة للعميل لبدء الرفع المباشر
  return res.status(200).json({
    success: true,
    bunnyVideoId,      // سيُستخدم لاحقاً لربط الفيديو بالـ chapter في DB
    libraryId,         // سيحتاجه العميل في headers
    signature,         // التوقيع الذي سيتم إرساله في الـ headers
    expiresAt,         // وقت الانتهاء
    chapterId,
    title: videoTitle,
  });
}
