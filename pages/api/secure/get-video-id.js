// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import ytdl from 'ytdl-core'; // [ ✅✅ جديد: استيراد المكتبة ]

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) {
    return res.status(400).json({ message: 'Missing lessonId' });
  }
  
  let youtubeId; // (سنحتاجه في كل الأحوال)

  try {
    // 1. جلب ID الفيديو من قاعدة البيانات (للأمان)
    const { data, error } = await supabase
      .from('videos')
      .select('youtube_video_id')
      .eq('id', lessonId)
      .single();

    if (error || !data || !data.youtube_video_id) {
      throw new Error('Video not found or permission denied');
    }

    youtubeId = data.youtube_video_id;

    // --- [ ✅✅ بداية: كود الاختبار واللوج (طلبك) ] ---
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      console.log(`[TEST] Attempting to fetch info for: ${youtubeId}`);
      const info = await ytdl.getInfo(videoUrl);
      
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

      // [ ✅✅✅ هذا هو اللوج الذي طلبته ]
      console.log(`[TEST SUCCESS] Video: ${info.videoDetails.title}`);
      console.log(`[TEST SUCCESS] Stream URL Found: ${streamUrl}`);

    } catch (ytdlError) {
      // (إذا فشل السحب، اطبع الخطأ فقط ولا توقف العملية)
      console.error(`[TEST FAILED] ytdl Error for ${youtubeId}:`, ytdlError.message);
    }
    // --- [ ✅✅ نهاية: كود الاختبار واللوج ] ---


    // 2. [ ✅✅ الأهم ] إرجاع الـ ID للمشغل كما كان
    // (هذا يضمن أن المشغل Plyr سيستمر في العمل كالمعتاد)
    res.status(200).json({ 
        youtube_video_id: youtubeId 
    });

  } catch (err) {
    // (هذا الخطأ يحدث فقط إذا فشل Supabase)
    console.error(`[CRITICAL] Supabase error for lessonId ${lessonId}:`, err.message);
    res.status(404).json({ message: err.message });
  }
};
