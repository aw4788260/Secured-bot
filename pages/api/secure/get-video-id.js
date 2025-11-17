// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import ytdl from 'ytdl-core';

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

    // --- [ ✅✅✅ هذا هو الإصلاح: إضافة الكوكيز ] ---
    
    // 2. جلب الكوكيز من متغيرات البيئة الآمنة
    const cookies = process.env.YOUTUBE_COOKIES;
    if (!cookies) {
        console.error("[CRITICAL] YOUTUBE_COOKIES environment variable is not set on Vercel!");
        throw new Error("Server configuration error: Missing cookies.");
    }

    // 3. إعداد خيارات الطلب (لإرسال الكوكيز)
    const requestOptions = {
      requestOptions: {
        headers: {
          cookie: cookies,
          // (إضافة User-Agent احتياطياً)
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
        }
      }
    };

    // 4. سحب الرابط (باستخدام الكوكيز)
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    console.log(`[ytdl] Auth success. Fetching info for: ${youtubeId} (with cookies)`);
    
    // (تمرير الخيارات الجديدة هنا)
    const info = await ytdl.getInfo(videoUrl, requestOptions); 
    
    const format = ytdl.chooseFormat(info.formats, { 
        quality: 'highestaudio', 
        filter: 'audioandvideo' 
    });
    
    let streamUrl;
    if (format && format.url) {
      streamUrl = format.url;
    } else {
       const fallbackFormat = ytdl.chooseFormat(info.formats, { container: 'mp4', filter: 'audioandvideo' });
       streamUrl = fallbackFormat ? fallbackFormat.url : "No suitable format found";
    }

    // [ ✅✅✅ اللوج الذي طلبته ]
    console.log(`[TEST SUCCESS] Video: ${info.videoDetails.title}`);
    console.log(`[TEST SUCCESS] Stream URL Found: ${streamUrl}`);
    // --- [ ✅✅✅ نهاية الإصلاح ] ---


    // 5. إرجاع الـ ID للمشغل كالمعتاد (كما طلبت)
    res.status(200).json({ 
        youtube_video_id: youtubeId 
    });

  } catch (err) {
    console.error(`[ytdl FAILED] Error for ${youtubeId}:`, err.message);
    // (إرجاع الخطأ 410 الذي رأيناه)
    if (err.message.includes("Status code: 410")) {
         res.status(410).json({ message: "Video blocked by YouTube (410 Gone). Check Cookies." });
    } else {
         res.status(500).json({ message: err.message });
    }
  }
};
