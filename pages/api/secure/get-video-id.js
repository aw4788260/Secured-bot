import { supabase } from '../../../lib/supabaseClient';
import ytdl from '@distube/ytdl-core';

// --- [ 1. إعدادات الكود من Colab ] ---

// ⚠️ الكوكيز الثابتة من كود Colab (كما طلبت)
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


// --- [ 2. دالة الفحص (التي طلبتها) ] ---
// (هذه الدالة هي كود Colab، سنستدعيها ونطبع ناتجها في اللوج)
async function runYtdlCheck(youtubeId) {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    console.log(`[YTDL-CHECK] Running check for: ${youtubeId}`);
    
    // (استدعاء كود Colab)
    const info = await ytdl.getInfo(videoUrl, { agent });
    
    // (اختيار فورمات 720p أو الأفضل المتاح)
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: f => f.container === 'mp4' && f.hasAudio && f.hasVideo,
    });

    if (!format || !format.url) {
      throw new Error("ytdl-core could not find a valid stream format.");
    }

    // --- [ ✅ هذا هو "الناتج" الذي طلبته في اللوج ] ---
    console.log(`[YTDL-CHECK SUCCEEDED] Title: ${info.videoDetails.title}`);
    console.log(`[YTDL-CHECK SUCCEEDED] Stream URL (partial): ${format.url.substring(0, 100)}...`);

    // (نرجع البيانات ليستخدمها الأندرويد)
    return {
      streamUrl: format.url,
      videoTitle: info.videoDetails.title
    };

  } catch (err) {
    // --- [ ✅ وهذا هو "ناتج" الخطأ الذي طلبته في اللوج ] ---
    console.error(`[YTDL-CHECK FAILED] Error for ${youtubeId}:`, err.message);
    throw err; // (ارم الخطأ ليكمل الكود)
  }
}


// --- [ 3. الـ API الرئيسي المحدث ] ---
export default async (req, res) => {
  
  // --- [ المسار 1: تطبيق الويب (watch page) ] ---
  if (req.query.lessonId) {
    const { lessonId } = req.query;
    if (!lessonId) return res.status(400).json({ message: 'Missing lessonId' });

    let youtubeId; // (سنحتاج هذا)

    try {
      // (أ) جلب الـ ID من Supabase (كما كان)
      const { data, error } = await supabase
        .from('videos')
        .select('youtube_video_id')
        .eq('id', lessonId)
        .single();

      if (error || !data || !data.youtube_video_id) {
        throw new Error('Video not found or permission denied');
      }
      
      youtubeId = data.youtube_video_id;

      // (ب) [✅✅✅ هذا هو التعديل المطلوب]
      // (تشغيل الفحص... وطباعة الناتج في اللوج)
      // (إذا فشل الفحص، سيرمي خطأ وسيمنع المشاهدة)
      await runYtdlCheck(youtubeId); 

      // (ج) إرجاع الرد الذي يحتاجه الويب (إذا نجح الفحص)
      res.status(200).json({ 
          youtube_video_id: youtubeId 
      });

    } catch (err) {
      // (إذا فشل الفحص، سيرمي الخطأ هنا وسيمنع المشاهدة)
      console.error(`[Web App FAILED] Error for lessonId ${lessonId}:`, err.message);
      res.status(500).json({ message: err.message || 'Web app check failed' });
    }
    return; 
  }

  // --- [ المسار 2: تطبيق الأندرويد (DownloadWorker) ] ---
  if (req.query.youtubeId) {
    const { youtubeId } = req.query;
    if (!youtubeId) return res.status(400).json({ message: 'Missing youtubeId' });

    try {
      // (أ) [✅✅✅ هذا هو التعديل المطلوب]
      // (تشغيل الفحص... وطباعة الناتج في اللوج)
      // (هذه المرة سنهتم بالنتيجة)
      const checkResult = await runYtdlCheck(youtubeId); 

      // (ب) إرجاع الرد الذي يحتاجه الأندرويد
      res.status(200).json({ 
          streamUrl: checkResult.streamUrl,
          videoTitle: checkResult.videoTitle 
      });

    } catch (err) {
      // (سيتم طباعة الخطأ في اللوج بواسطة الدالة)
      res.status(500).json({ message: err.message || 'ytdl-core execution failed' });
    }
    return; 
  }

  // (حالة خطأ: إذا لم يتم إرسال أي بارامتر)
  res.status(400).json({ message: 'Missing lessonId or youtubeId' });
};
