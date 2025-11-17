// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

const PYTHON_PROXY_BASE_URL = 'https://web-production-3a04a.up.railway.app';

export default async (req, res) => {
  
  if (req.query.lessonId) {
    const { lessonId } = req.query;
    let youtubeId; 
    
    try {
      // 1. التحقق من Supabase
      const { data, error } = await supabase
        .from('videos')
        .select('youtube_video_id')
        .eq('id', lessonId)
        .single();

      if (error || !data || !data.youtube_video_id) {
        throw new Error('Video not found or permission denied');
      }
      youtubeId = data.youtube_video_id;

      // 2. [ ✅✅✅ هذا هو التعديل ]
      // (تم تغيير المسار من /get-hls-playlist إلى /get-video-info)
      // (هذا المسار يرجع رابط MP4 مباشر ومضمون)
      const stream_url_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-video-info`;
      
      console.log(`[Vercel App] Getting MP4 Stream for ${youtubeId} from Railway...`);
      
      const proxyResponse = await axios.get(stream_url_endpoint, { params: { youtubeId } });
      
      // 3. [ ✅✅✅ تعديل ]
      // (الآن streamUrl هو رابط MP4)
      console.log(`[Vercel App] Railway MP4 check SUCCESS for ${youtubeId}`);
      res.status(200).json({ 
          streamUrl: proxyResponse.data.streamUrl, // <-- هذا الآن رابط MP4
          videoTitle: proxyResponse.data.videoTitle,
          youtube_video_id: youtubeId 
      });

    } catch (err) {
      console.error(`[Vercel App] Check FAILED:`, err.response ? err.response.data.message : err.message);
      res.status(500).json({ message: "Video check failed (Proxy Error)" });
    }
  } else {
    res.status(400).json({ message: 'Missing lessonId' });
  }
};
