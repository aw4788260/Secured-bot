// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

const PYTHON_PROXY_BASE_URL = 'https://web-production-3a04a.up.railway.app';

export default async (req, res) => {
  if (req.query.lessonId) {
    const { lessonId } = req.query;
    
    try {
      const { data } = await supabase
        .from('videos')
        .select('youtube_video_id')
        .eq('id', lessonId)
        .single();

      const youtubeId = data.youtube_video_id;

      // [ 👇 التغيير هنا: طلبنا HLS عشان نشوف الخطأ ]
      const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
      console.log(`[Debug] Requesting HLS for ${youtubeId}...`);
      
      const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
      
      res.status(200).json({ 
          streamUrl: proxyResponse.data.streamUrl, 
          videoTitle: proxyResponse.data.videoTitle,
          youtube_video_id: youtubeId 
      });

    } catch (err) {
      res.status(500).json({ message: "Server fetch failed" });
    }
  }
};
