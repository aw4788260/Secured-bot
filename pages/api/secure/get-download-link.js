// pages/api/secure/get-download-link.js
import axios from 'axios';

// (هذا هو السيرفر الخارجي الذي سنستخدمه، وهو سريع وموثوق)
const COBALT_API_URL = 'https://api.cobalt.tools/api/json';

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    // 1. (إرسال الطلب للسيرفر الخارجي)
    const response = await axios.post(
      COBALT_API_URL,
      {
        url: videoUrl,
        vQuality: '720', // (اطلب جودة 720p)
        isAudioOnly: false,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    // 2. (تحليل الرد)
    if (response.data && response.data.status === 'success' && response.data.url) {
      // (نجحنا! أرسل الرابط لتطبيق الأندرويد)
      res.status(200).json({ downloadUrl: response.data.url });
    
    } else if (response.data && response.data.status === 'picker') {
        // (إذا لم يجد جودة 720p، سيقترح جودات أخرى، سنأخذ أول واحدة)
        const fallbackUrl = response.data.picker[0].url;
        res.status(200).json({ downloadUrl: fallbackUrl });
        
    } else {
      // (فشل السيرفر الخارجي)
      throw new Error(response.data.text || 'Cobalt API failed');
    }

  } catch (err) {
    console.error(`[Cobalt API CRASH] ID: ${youtubeId}, Error:`, err.response ? err.response.data : err.message);
    res.status(500).json({ error: `External API failed: ${err.message}` });
  }
};
