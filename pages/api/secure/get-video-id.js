// pages/api/secure/get-video-id.js
import ytdl from 'ytdl-core'; // [ ✅✅ جديد: استيراد المكتبة ]

// (لم نعد بحاجة لـ Supabase هنا لأننا نختبر)

export default async (req, res) => {
  const { youtubeId } = req.query;
  if (!youtubeId) {
    return res.status(400).json({ message: 'Missing youtubeId' });
  }
  
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    // 1. جلب معلومات الفيديو
    console.log(`[TEST] Attempting to fetch info for: ${youtubeId}`);
    const info = await ytdl.getInfo(videoUrl);
    
    // 2. اختيار أفضل صيغة (صوت وصورة)
    const format = ytdl.chooseFormat(info.formats, { 
        quality: 'highestaudio', 
        filter: 'audioandvideo' 
    });
    
    let streamUrl;
    let videoTitle = info.videoDetails.title;

    if (!format || !format.url) {
       // (خطة بديلة: اختيار أي صيغة MP4)
       const fallbackFormat = ytdl.chooseFormat(info.formats, { container: 'mp4', filter: 'audioandvideo' });
       if (!fallbackFormat || !fallbackFormat.url) {
           throw new Error('No suitable video format found.');
       }
       streamUrl = fallbackFormat.url;
    } else {
       streamUrl = format.url;
    }

    // 3. [ ✅✅✅ هذا هو طلبك: طباعة الرابط في اللوج ]
    console.log(`[TEST SUCCESS] Video: ${videoTitle}`);
    console.log(`[TEST SUCCESS] Stream URL Found: ${streamUrl}`);

    // 4. إرسال رد ناجح للتطبيق
    res.status(200).json({ 
        success: true, 
        message: "Test success. Check Vercel logs for URL.",
        title: videoTitle
    });

  } catch (err) {
    // 5. طباعة الخطأ في اللوج إذا فشل
    console.error(`[TEST FAILED] ytdl Error for ${youtubeId}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
