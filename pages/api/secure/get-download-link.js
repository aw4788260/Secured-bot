// pages/api/secure/get-download-link.js
import play from 'play-dl';

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    // (تعيين مصدر IP وهمي لتجاوز حظر يوتيوب على Vercel)
    await play.setToken({
        youtube: {
            cookie: process.env.YOUTUBE_COOKIE || '' 
        }
    });

    // 1. جلب معلومات الفيديو (هذه المكتبة أسرع)
    const info = await play.video_info(videoUrl, {
        request: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }
    });

    // 2. البحث عن صيغة mp4 (itag 22 أو 18)
    let bestFormat = info.format.find(f => f.itag === 22 && f.container === 'mp4');
    if (!bestFormat) {
        bestFormat = info.format.find(f => f.itag === 18 && f.container === 'mp4');
    }

    // (إذا لم نجدها، نحاول جلب أفضل صيغة mp4 متاحة)
    if (!bestFormat) {
        const mp4Formats = info.format.filter(f => f.container === 'mp4' && f.hasAudio && f.hasVideo);
        if (mp4Formats.length > 0) {
            bestFormat = mp4Formats[0];
        }
    }

    if (!bestFormat || !bestFormat.url) {
      throw new Error('No suitable mp4 format found (itag 22/18 or other)');
    }

    // 3. إرسال الرابط
    res.status(200).json({ downloadUrl: bestFormat.url });

  } catch (err) {
    console.error(`[play-dl CRASH] ID: ${youtubeId}, Error: ${err.message}`);
    // (إظهار الخطأ الحقيقي للأندرويد)
    res.status(500).json({ error: `Server failed (play-dl): ${err.message}` });
  }
};
