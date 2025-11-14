// pages/api/secure/get-download-link.js
import ytdl from 'ytdl-core';

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const info = await ytdl.getInfo(videoUrl);
    
    // (نفس المنطق الذي كان في الأندرويد: ابحث عن 720p أو 360p)
    let format = ytdl.chooseFormat(info.formats, { 
        quality: '22', // itag 22 (720p, mp4)
        filter: format => format.container === 'mp4' && format.hasAudio && format.hasVideo
    });

    if (!format) {
      format = ytdl.chooseFormat(info.formats, { 
          quality: '18', // itag 18 (360p, mp4)
          filter: format => format.container === 'mp4' && format.hasAudio && format.hasVideo
      });
    }

    if (!format) {
      throw new Error('No suitable mp4 format found (itag 22 or 18)');
    }

    // (إرسال الرابط كـ JSON)
    res.status(200).json({ downloadUrl: format.url });

  } catch (err) {
    console.error(`ytdl-core error for ID ${youtubeId}:`, err.message);
    res.status(500).json({ error: `Server failed to get link: ${err.message}` });
  }
};
