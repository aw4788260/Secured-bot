// pages/api/secure/get-download-link.js
import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';

// (مسار مؤقت لكتابة ملف الكوكيز فيه)
const COOKIE_FILE_PATH = path.join('/tmp', 'youtube-cookies.txt');
// (مسار تحميل أداة yt-dlp)
const YTDLP_PATH = path.join('/tmp', 'yt-dlp');

// (دالة مساعدة لتحميل الأداة إذا لم تكن موجودة)
async function downloadYtDlp() {
  if (fs.existsSync(YTDLP_PATH)) {
    return; // (موجودة بالفعل)
  }
  console.log('yt-dlp binary not found, downloading...');
  await YTDlpWrap.downloadFromGithub(YTDLP_PATH);
  console.log('yt-dlp binary downloaded successfully.');
}

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    // 1. (التأكد من وجود الأداة)
    await downloadYtDlp();
    
    // (إنشاء نسخة جديدة من الأداة)
    const ytdlp = new YTDlpWrap(YTDLP_PATH);

    // 2. (جلب الكوكيز من متغيرات Vercel)
    const cookieValue = process.env.YOUTUBE_COOKIE;
    if (!cookieValue) {
        throw new Error('YOUTUBE_COOKIE is not set on the server.');
    }
    
    // (كتابة الكوكيز في ملف مؤقت)
    fs.writeFileSync(COOKIE_FILE_PATH, cookieValue);

    // 3. (تجهيز الأوامر)
    const args = [
      videoUrl,
      '--format',
      '22/18/best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best',
      '--get-url',
      '--cookie',
      COOKIE_FILE_PATH, // (استخدام ملف الكوكيز)
    ];

    // 4. (تنفيذ الأمر)
    const output = await new Promise((resolve, reject) => {
      let out = '';
      let err = '';
      
      ytdlp.exec(args)
        .on('stdout', (data) => (out += data.toString()))
        .on('stderr', (data) => (err += data.toString()))
        .on('error', (error) => reject(error))
        .on('close', (code) => {
          if (code === 0) {
            resolve(out);
          } else {
            reject(new Error(err || `yt-dlp exited with code ${code}`));
          }
        });
    });

    // 5. (تنظيف الملف المؤقت)
    fs.unlinkSync(COOKIE_FILE_PATH);

    // (الناتج سيكون هو الرابط مباشرة)
    if (!output || !output.startsWith('https://')) {
      throw new Error('yt-dlp did not return a valid URL.');
    }

    // 6. (إرسال الرابط لتطبيق الأندرويد)
    res.status(200).json({ downloadUrl: output.trim() });

  } catch (err) {
    // (تنظيف الملف المؤقت في حال حدوث خطأ)
    if (fs.existsSync(COOKIE_FILE_PATH)) {
        fs.unlinkSync(COOKIE_FILE_PATH);
    }
    
    // (إظهار الخطأ الحقيقي)
    const errorMessage = err.stderr || err.message;
    console.error(`[yt-dlp-wrap CRASH] ID: ${youtubeId}, Error:`, errorMessage);
    res.status(500).json({ error: `Server failed (yt-dlp-wrap): ${errorMessage}` });
  }
};
