// pages/api/secure/get-download-link.js
import axios from 'axios';

// (استخدام سيرفر خارجي جديد ومختلف يعمل حالياً)
const API_URL = 'https://api.y2mate.app/api/v1/info';

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  // (هذا السيرفر يفضل الرابط الكامل)
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    // 1. (إرسال الطلب للسيرفر الخارجي الجديد)
    const response = await axios.get(API_URL, {
      params: {
        url: videoUrl,
      },
      headers: {
        Accept: 'application/json',
      },
      timeout: 8000, // (مهلة 8 ثواني)
    });

    // 2. (تحليل الرد)
    const links = response.data?.links;
    if (!links || !links.mp4 || links.mp4.length === 0) {
      throw new Error('No MP4 links found by y2mate API');
    }

    // 3. (البحث عن الجودة المطلوبة)
    let downloadUrl = links.mp4.find((f) => f.q === '720p')?.url;
    if (!downloadUrl) {
      downloadUrl = links.mp4.find((f) => f.q === '360p')?.url;
    }
    // (إذا لم نجدها، نأخذ أول جودة متاحة)
    if (!downloadUrl) {
      downloadUrl = links.mp4[0].url;
    }

    if (!downloadUrl) {
      throw new Error('Could not extract a valid download URL');
    }

    // 4. (إرسال الرابط لتطبيق الأندرويد)
    res.status(200).json({ downloadUrl });

  } catch (err) {
    let errorMessage = err.message;
    if (err.response && err.response.data && err.response.data.error) {
      errorMessage = err.response.data.error;
    }
    
    console.error(`[y2mate API CRASH] ID: ${youtubeId}, Error:`, errorMessage);
    res.status(500).json({ error: `External API (y2mate) failed: ${errorMessage}` });
  }
};
