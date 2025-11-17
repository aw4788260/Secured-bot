// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
// [ ✅✅✅ تعديل: استيراد "stream" فقط ]
import { stream } from 'play-dl'; 

// [ 🛑🛑 حذف: لم نعد بحاجة لـ setToken ]
// (سنقوم بتمرير الكوكيز مع كل طلب لضمان الأمان)

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) {
    return res.status(400).json({ message: 'Missing lessonId' });
  }
  
  let youtubeId; 

  try {
    // 1. التحقق الأمني من Supabase (كما كان)
    const { data, error } = await supabase
      .from('videos')
      .select('youtube_video_id')
      .eq('id', lessonId)
      .single();

    if (error || !data || !data.youtube_video_id) {
      throw new Error('Video not found or permission denied');
    }

    youtubeId = data.youtube_video_id;
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    // --- [ ✅✅✅ بداية: الإصلاح النهائي ] ---
    
    // 2. جلب الكوكيز من متغيرات البيئة الآمنة
    const cookies = process.env.YOUTUBE_COOKIES;
    if (!cookies) {
        console.error("[CRITICAL] YOUTUBE_COOKIES environment variable is not set on Vercel!");
        throw new Error("Server configuration error: Missing cookies.");
    }
    console.log(`[play-dl] Cookies loaded. Attempting stream for: ${youtubeId}`);

    // 3. [ ✅✅✅ الأهم ]
    // (استدعاء "stream" مباشرة وتمرير الكوكيز لها)
    const streamData = await stream(videoUrl, {
        quality: 2, // (جودة 720p أو 1080p)
        youtube: { // (تمرير الكوكيز هنا)
            cookie: cookies 
        }
    });

    const streamUrl = streamData.url;
    
    // [ ✅✅✅ اللوج الذي طلبته ]
    // (العنوان غير متوفر لأننا تخطينا video_info، وهذا طبيعي للاختبار)
    console.log(`[TEST SUCCESS] Video: ${youtubeId}`);
    console.log(`[TEST SUCCESS] Stream URL Found: ${streamUrl.substring(0, 100)}...`);

    // --- [ ✅✅✅ نهاية: الإصلاح النهائي ] ---

    // 4. إرجاع الـ ID للمشغل كالمعتاد
    res.status(200).json({ 
        youtube_video_id: youtubeId 
    });

  } catch (err) {
    console.error(`[play-dl FAILED] Error for ${youtubeId}:`, err.message);
    res.status(500).json({ message: err.message || 'play-dl execution failed' });
  }
};
