// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
// [ ✅✅✅ جديد: استيراد المكتبة الصحيحة ]
import { video_info, stream, setToken } from 'play-dl'; 

// [ ✅✅✅ جديد: إعداد الكوكيز (مرة واحدة عالمياً) ]
// (يقرأ الكوكيز من Vercel ويجهز المكتبة)
const cookies = process.env.YOUTUBE_COOKIES;
if (cookies) {
    setToken({
        youtube: {
            cookie: cookies 
        }
    });
    console.log("[play-dl] YouTube cookies set successfully.");
} else {
    console.error("[CRITICAL] YOUTUBE_COOKIES environment variable is not set on Vercel!");
}


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

    // --- [ ✅✅✅ بداية: تطبيق منطق play-dl ] ---
    
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    console.log(`[play-dl] Auth success. Fetching info for: ${youtubeId} (with cookies)`);
    
    // 2. جلب معلومات الفيديو (باستخدام الكوكيز)
    const info = await video_info(videoUrl);

    // 3. جلب رابط البث (باستخدام الكوكيز)
    const streamData = await stream(videoUrl, {
        quality: 2 // (جودة 720p أو 1080p - يمكنك تغييرها)
    });

    const streamUrl = streamData.url;
    
    // [ ✅✅✅ اللوج الذي طلبته ]
    console.log(`[TEST SUCCESS] Video: ${info.video_details.title}`);
    console.log(`[TEST SUCCESS] Stream URL Found: ${streamUrl.substring(0, 100)}...`);

    // --- [ ✅✅✅ نهاية: تطبيق منطق play-dl ] ---

    // 4. إرجاع الـ ID للمشغل كالمعتاد
    res.status(200).json({ 
        youtube_video_id: youtubeId 
    });

  } catch (err) {
    console.error(`[play-dl FAILED] Error for ${youtubeId}:`, err.message);
    res.status(500).json({ message: err.message || 'play-dl execution failed' });
  }
};
