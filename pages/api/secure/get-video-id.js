import { supabase } from '../../../lib/supabaseClient';
import ytdl from '@distube/ytdl-core';

// ⚠️ الكوكيز التي أرسلتها (من كود Colab) أصبحت هنا
const hardcodedCookies = [
  "APISID=YCj4RD7H6PBQR2Du/ArlQgkOCHT3eSS8_-",
  "SAPISID=rirduiJSx3-Gb8Og/AApbQlnHxVw2_tijX",
  "__Secure-1PAPISID=rirduiJSx3-Gb8Og/AApbQlnHxVw2_tijX",
  "__Secure-3PAPISID=rirduiJSx3-Gb8Og/AApbQlnHxVw2_tijX",
  "SID=g.a0003gjDsrYAXLuqBTmYUnW8bfKOz7_-9jfy09MhkDgRlfizxZ6XSjTlYL6xx4w7JY5_o2clcQACgYKAWISARYSFQHGX2MiDpZsacPJu-ZgbMU4XhP4WhoVAUF8yKq0a7SEjMtqZlVpBhqoGmr40076",
  "PREF=f6=40000000&tz=Africa.Cairo",
  "SIDCC=AKEyXzVglg5IFqX6kpeKEtD0O025ej7MjvPxUyqX-MMW4wwmnJxSH4K9qe_BKKwvHyeZEmeMFQ"
];

// ⚠️ إنشاء الـ Agent مرة واحدة (كما في كود Colab)
const agent = ytdl.createAgent(hardcodedCookies);


export default async (req, res) => {
  
  // --- [ 1. المسار الخاص بتطبيق الويب (watch page) ] ---
  if (req.query.lessonId) {
    const { lessonId } = req.query;
    if (!lessonId) {
      return res.status(400).json({ message: 'Missing lessonId' });
    }

    try {
      // (نفس الكود القديم للتحقق من Supabase)
      const { data, error } = await supabase
        .from('videos')
        .select('youtube_video_id')
        .eq('id', lessonId)
        .single();

      if (error || !data || !data.youtube_video_id) {
        throw new Error('Video not found or permission denied');
      }

      console.log(`[Web App Request] Success for lessonId: ${lessonId}`);
      // (إرجاع الرد الذي يحتاجه الويب)
      res.status(200).json({ 
          youtube_video_id: data.youtube_video_id 
      });

    } catch (err) {
      console.error(`[Web App FAILED] Error for lessonId ${lessonId}:`, err.message);
      res.status(500).json({ message: err.message || 'Web app check failed' });
    }
    return; // (إنهاء التنفيذ هنا)
  }

  // --- [ 2. المسار الخاص بتطبيق الأندرويد (DownloadWorker) ] ---
  if (req.query.youtubeId) {
    const { youtubeId } = req.query;
    if (!youtubeId) {
      return res.status(400).json({ message: 'Missing youtubeId' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    try {
      console.log(`[Android App Request] Attempting info for: ${youtubeId}`);
      
      // (نفس الكود الناجح من Colab)
      const info = await ytdl.getInfo(videoUrl, { agent });
      
      // (اختيار فورمات 720p أو الأفضل المتاح)
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highestvideo',
        filter: f => f.container === 'mp4' && f.hasAudio && f.hasVideo,
      });

      if (!format || !format.url) {
        throw new Error("ytdl-core could not find a valid stream format.");
      }

      const streamUrl = format.url;
      const videoTitle = info.videoDetails.title;

      console.log(`[Android App Success] Stream found for: ${videoTitle}`);
      
      // (إرجاع الـ JSON الذي يحتاجه تطبيق الأندرويد)
      res.status(200).json({ 
          streamUrl: streamUrl,
          videoTitle: videoTitle 
      });

    } catch (err) {
      console.error(`[Android App FAILED] Error for ${youtubeId}:`, err.message);
      // (هنا سيظهر خطأ "bot" إذا استمرت المشكلة)
      res.status(500).json({ message: err.message || 'ytdl-core execution failed' });
    }
    return; // (إنهاء التنفيذ هنا)
  }

  // (حالة خطأ: إذا لم يتم إرسال أي بارامتر)
  res.status(400).json({ message: 'Missing lessonId or youtubeId' });
};
