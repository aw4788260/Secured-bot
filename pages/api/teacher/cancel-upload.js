import { verifyTeacher } from '../../../lib/teacherAuth';
import { supabase } from '../../../lib/supabaseClient';

// ===================================================================
// 📱 [APP] إلغاء/تنظيف جلسة رفع فيديو لم تكتمل بعد على Bunny Stream
// ===================================================================
// يُستدعى من التطبيق عندما يضغط المعلم "إلغاء" بشكل صريح أثناء الرفع،
// أو عندما يبدأ التطبيق جلسة رفع جديدة من الصفر متجاهلاً جلسة قديمة.
// ✅ هذا لا يحذف أي فيديو تم تأكيده (confirm-upload) ولا يوجد له صف في
//    قاعدة البيانات بعد — فقط ينظف الكائن الفارغ الذي أُنشئ على Bunny
//    عبر create-upload-session ولم يُستكمل رفعه أو لم يُؤكّد بعد.
// ===================================================================

function getLibraryConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error('متغيرات البيئة الخاصة بـ Bunny Stream غير مكتملة');
  }
  return { libraryId, apiKey };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = await verifyTeacher(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { bunnyVideoId } = req.body || {};
  if (!bunnyVideoId) {
    return res.status(400).json({ error: 'bunnyVideoId مطلوب' });
  }

  try {
    // تأكيد أن هذا الفيديو لم يُحفظ فعلاً في قاعدة البيانات (لمنع حذف فيديو منشور)
    const { data: existing } = await supabase
      .from('videos')
      .select('id')
      .eq('bunny_video_id', bunnyVideoId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'لا يمكن إلغاء فيديو تم حفظه بالفعل.' });
    }

    const { libraryId, apiKey } = getLibraryConfig();
    await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey, accept: 'application/json' },
    }).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ [teacher/cancel-upload] Error:', err.message);
    // غير حرج — لا نوقف تجربة المستخدم بسبب فشل تنظيف
    return res.status(200).json({ success: true, cleaned: false });
  }
}
