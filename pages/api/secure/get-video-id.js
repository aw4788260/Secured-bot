import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

const PYTHON_PROXY_BASE_URL = 'https://web-production-3a04a.up.railway.app';

export default async (req, res) => {
    if (req.query.lessonId) {
        const { lessonId } = req.query;
        
        try {
            // 1. جلب الـ youtubeId من قاعدة البيانات
            const { data, error: supabaseError } = await supabase
                .from('videos')
                .select('youtube_video_id')
                .eq('id', lessonId)
                .single();

            if (supabaseError || !data) {
                 console.error("Supabase Error:", supabaseError);
                 return res.status(404).json({ message: "Video ID not found in database." });
            }

            const youtubeId = data.youtube_video_id;

            // 2. طلب قائمة الجودات من سيرفر Flask
            const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
            console.log(`[Debug] Requesting HLS for ${youtubeId} from proxy...`);
            
            const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
            
            // 3. [التعديل الهام] ندمج البيانات من Flask (والتي تحتوي على availableQualities و videoTitle)
            // ونضيف عليها youtube_video_id
            const flaskData = proxyResponse.data;

            res.status(200).json({ 
                ...flaskData, 
                youtube_video_id: youtubeId 
            });

        } catch (err) {
            console.error("Server fetch failed:", err.message);
            // إذا فشل Axios، قد يكون الرد غير JSON، نرسل خطأ 500 للمشاهد
            res.status(500).json({ message: "Failed to fetch video details from Python Proxy." });
        }
    } else {
        res.status(400).json({ message: "Missing lessonId" });
    }
};
