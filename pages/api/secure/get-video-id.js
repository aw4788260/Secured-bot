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
            
            // (تم حذف اللوج القديم لتقليل الزحمة، سنكتفي باللوج الجديد)
            
            const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
            
            const flaskData = proxyResponse.data;

            // ✅✅✅ [ التعديل الجديد: طباعة المدة في Vercel Logs ] ✅✅✅
            // ابحث عن هذه الرسالة في تبويب Logs في Vercel Dashboard
            if (flaskData.duration) {
                console.log(`--------------------------------------------------`);
                console.log(`🔍 [DEBUG] Video ID: ${youtubeId}`);
                console.log(`⏱️ [DEBUG] Duration Value: ${flaskData.duration}`);
                console.log(`TYPE [DEBUG] Duration Type: ${typeof flaskData.duration}`);
                console.log(`--------------------------------------------------`);
            } else {
                console.log(`⚠️ [DEBUG] No duration returned for ${youtubeId}`);
            }
            // -------------------------------------------------------

            // 3. دمج البيانات وإرسال الرد
            res.status(200).json({ 
                ...flaskData, 
                youtube_video_id: youtubeId 
            });

        } catch (err) {
            console.error("Server fetch failed:", err.message);
            res.status(500).json({ message: "Failed to fetch video details from Python Proxy." });
        }
    } else {
        res.status(400).json({ message: "Missing lessonId" });
    }
};
