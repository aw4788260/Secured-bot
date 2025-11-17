// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

// [ ✅✅ الرابط الأساسي لسيرفر Railway ]
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

      // 2. [ ✅✅ تعديل: بنكلم المسار الجديد بتاع الجودات (HLS) ]
      const hls_playlist_url = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
      
      console.log(`[Vercel App] Getting HLS Playlist for ${youtubeId} from Railway...`);
      
      const proxyResponse = await axios.get(hls_playlist_url, { params: { youtubeId } });
      
      // 3. [ ✅✅ تعديل: بنرجع لينك الـ M3U8 ]
      console.log(`[Vercel App] Railway HLS check SUCCESS for ${youtubeId}`);
      res.status(200).json({ 
          streamUrl: proxyResponse.data.streamUrl, // <-- ده لينك m3u8
          videoTitle: proxyResponse.data.videoTitle,
          youtube_video_id: youtubeId // (ده هيفضل موجود عشان زرار التحميل)
      });

    } catch (err) {
      console.error(`[Vercel App] Check FAILED:`, err.response ? err.response.data.message : err.message);
      res.status(500).json({ message: "Video check failed (Proxy Error)" });
    }
  } else {
    res.status(400).json({ message: 'Missing lessonId' });
  }
};
