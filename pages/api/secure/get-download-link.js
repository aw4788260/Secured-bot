// pages/api/secure/get-download-link.js
import axios from 'axios';

// [ ✅✅✅ هذا هو الإصلاح: استخدام البديل الرسمي والجديد لـ Cobalt ✅✅✅ ]
// (هذا السيرفر يعمل ومصمم لتجاوز الحظر)
const COYOT_API_URL = 'https://api.coyot.dev/api/json';

export default async (req, res) => {
  const { youtubeId } = req.query;

  if (!youtubeId) {
    return res.status(400).json({ error: 'Missing youtubeId' });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    // 1. (إرسال الطلب للسيرفر الخارجي الجديد)
    const response = await axios.post(
      COYOT_API_URL,
      {
        url: videoUrl,
        vQuality: '720', // (اطلب 720p)
        isAudioOnly: false,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 8000 // (مهلة 8 ثواني)
      }
    );

    // 2. (تحليل الرد - الكود متطابق مع Cobalt)
    if (response.data && response.data.status === 'success' && response.data.url) {
      // (نجحنا! أرسل الرابط لتطبيق الأندرويد)
      res.status(200).json({ downloadUrl: response.data.url });
    
    } else if (response.data && response.data.status === 'picker' && response.data.picker.length > 0) {
        // (إذا لم يجد جودة 720p، سنأخذ أول جودة بديلة)
        const fallbackUrl = response.data.picker[0].url;
        res.status(200).json({ downloadUrl: fallbackUrl });
        
    } else {
      // (فشل السيرفر الخارجي)
      throw new Error(response.data.text || 'coyot.dev API failed');
    }

  } catch (err) {
    // (التقاط أي خطأ من السيرفر الخارجي)
    let errorMessage = err.message;
    if (err.response && err.response.data && err.response.data.text) {
        errorMessage = err.response.data.text;
    }
    
    console.error(`[External API CRASH] ID: ${youtubeId}, Error:`, errorMessage);
    res.status(500).json({ error: `External API failed: ${errorMessage}` });
  }
};
