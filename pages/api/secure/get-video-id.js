// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import ytdl from 'ytdl-core';

export default async (req, res) => {
  // [ ✅✅ إصلاح 1: العودة لاستخدام lessonId ]
  const { lessonId } = req.query;
  if (!lessonId) {
    return res.status(400).json({ message: 'Missing lessonId' });
  }
  
  try {
    // [ ✅✅ إصلاح 2: إعادة التحقق الأمني من Supabase ]
    // (هذا هو الذي يحدد "هل لديك صلاحية أم لا")
    const { data, error } = await supabase
      .from('videos')
      .select('youtube_video_id')
      .eq('id', lessonId)
      .single();

    if (error || !data || !data.youtube_video_id) {
      console.error(`[AUTH FAILED] User requested lessonId ${lessonId}, but no matching video found in Supabase.`);
      throw new Error('Video not found or permission denied');
    }

    const youtubeId = data.youtube_video_id;
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    // [ ✅✅ 3. تنفيذ "سرقة" الرابط (كما طلبت) ]
    console.log(`[ytdl] Auth success. Fetching info for: ${youtubeId}`);
    const info = await ytdl.getInfo(videoUrl);
    
    // (اختيار أفضل صيغة صوت وصورة)
    const format = ytdl.chooseFormat(info.formats, { 
        quality: 'highestaudio', 
        filter: 'audioandvideo' 
    });
    
    let streamUrl;
    let videoTitle = info.videoDetails.title;

    if (!format || !format.url) {
       // (خطة بديلة)
       const fallbackFormat = ytdl.chooseFormat(info.formats, { container: 'mp4', filter: 'audioandvideo' });
       if (!fallbackFormat || !fallbackFormat.url) {
           throw new Error('No suitable video format found.');
       }
       streamUrl = fallbackFormat.url;
    } else {
       streamUrl = format.url;
    }

    console.log(`[ytdl SUCCESS] Stream URL Found for ${youtubeId}`);

    // [ ✅✅ 4. إرسال الرابط المسروق + ID الفيديو (لزر التحميل) ]
    res.status(200).json({ 
        streamUrl: streamUrl, // <-- الرابط المسروق (مثل r2.googlevideo.com)
        videoTitle: videoTitle,
        youtube_video_id: youtubeId // <-- سنحتاجه لزر التحميل في الأندرويد
    });

  } catch (err) {
    console.error(`[ytdl FAILED] Error fetching video ID ${req.query.lessonId}:`, err.message);
    res.status(500).json({ message: err.message });
  }
};
