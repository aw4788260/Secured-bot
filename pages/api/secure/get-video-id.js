// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

// [ ✅✅ الرابط الجديد بتاع Railway ]
const PYTHON_PROXY_URL = 'https://web-production-3a04a.up.railway.app/api/get-video-info';

export default async (req, res) => {
  
  if (req.query.lessonId) {
    const { lessonId } = req.query;
    let youtubeId; 
    
    try {
      // 1. جلب الـ ID من Supabase (زي ما كان)
      const { data, error } = await supabase
        .from('videos')
        .select('youtube_video_id')
        .eq('id', lessonId)
        .single();

      if (error || !data || !data.youtube_video_id) {
        throw new Error('Video not found or permission denied');
      }
      youtubeId = data.youtube_video_id;

      // 2. [ ✅✅ تعديل ] Vercel بيكلم Railway وبيجيب الرد
      console.log(`[Vercel App] Getting stream URL for ${youtubeId} from Railway...`);
      
      const proxyResponse = await axios.get(PYTHON_PROXY_URL, { params: { youtubeId } });
      
      // 3. [ ✅✅ تعديل ] إرجاع كل البيانات (الستريم + الـ ID)
      // (عشان صفحة المشاهدة تشغل الستريم، وزرار التحميل يلاقي الـ ID)
      console.log(`[Vercel App] Railway proxy check SUCCESS for ${youtubeId}`);
      res.status(200).json({ 
          streamUrl: proxyResponse.data.streamUrl,
          videoTitle: proxyResponse.data.videoTitle,
          youtube_video_id: youtubeId // <-- مهم جداً لزرار التحميل
      }); 

    } catch (err) {
      console.error(`[Vercel App] Check FAILED:`, err.response ? err.response.data.message : err.message);
      res.status(500).json({ message: "Video check failed (Proxy Error)" });
    }
  } else {
    res.status(400).json({ message: 'Missing lessonId' });
  }
};
