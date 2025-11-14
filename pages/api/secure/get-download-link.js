// pages/api/secure/get-download-link.js
import YTDlp from 'yt-dlp-exec';
import path from 'path';
import fs from 'fs';

// (مسار مؤقت لكتابة ملف الكوكيز فيه)
const COOKIE_FILE_PATH = path.join('/tmp', 'youtube-cookies.txt');

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    // 1. [ ✅✅✅ هذا هو الحل ✅✅✅ ]
    // (جلب الكوكيز من متغيرات Vercel)
    const cookieValue = process.env.YOUTUBE_COOKIE;
    if (!cookieValue) {
        throw new Error('YOUTUBE_COOKIE is not set on the server.');
    }
    
    // (كتابة الكوكيز في ملف مؤقت لأن yt-dlp يفضل القراءة من ملف)
    fs.writeFileSync(COOKIE_FILE_PATH, cookieValue);

    // 2. (استدعاء yt-dlp الحقيقي)
    const output = await YTDlp(videoUrl, {
      format: '22/18/best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best',
      getUrl: true,
      cookie: COOKIE_FILE_PATH, // (استخدام ملف الكوكيز)
    });

    // 3. (تنظيف الملف المؤقت)
    fs.unlinkSync(COOKIE_FILE_PATH);

    // (الناتج سيكون هو الرابط مباشرة)
    if (!output || !output.startsWith('https://')) {
      throw new Error('yt-dlp did not return a valid URL.');
    }

    // 4. (إرسال الرابط لتطبيق الأندرويد)
    res.status(200).json({ downloadUrl: output.trim() });

  } catch (err) {
    // (تنظيف الملف المؤقت في حال حدوث خطأ)
    if (fs.existsSync(COOKIE_FILE_PATH)) {
        fs.unlinkSync(COOKIE_FILE_PATH);
    }
    
    // (إظهار الخطأ الحقيقي)
    const errorMessage = err.stderr || err.message;
    console.error(`[yt-dlp-exec CRASH] ID: ${youtubeId}, Error:`, errorMessage);
    res.status(500).json({ error: `Server failed (yt-dlp-exec): ${errorMessage}` });
  }
};
