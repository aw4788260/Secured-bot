import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    const apiName = '[API: get-video-id]';
    console.log(`${apiName} 🚀 Request started.`);

    const { lessonId } = req.query;
    const userId = req.headers['x-user-id'];

    if (!lessonId) {
        console.warn(`${apiName} ❌ Missing lessonId.`);
        return res.status(400).json({ message: "Missing lessonId" });
    }

    console.log(`${apiName} 👤 User: ${userId} requesting Lesson: ${lessonId}`);

    try {
        // 1. التحقق الأمني
        console.log(`${apiName} 🔒 Checking access permissions...`);
        const hasAccess = await checkUserAccess(req, lessonId, 'video');

        if (!hasAccess) {
            console.warn(`${apiName} ⛔ Access Denied for user ${userId}.`);
            return res.status(403).json({ message: "Access Denied: Security Checks Failed" });
        }
        console.log(`${apiName} ✅ Access Granted.`);

        // 2. جلب بيانات الفيديو
        console.log(`${apiName} 🔍 Fetching video details from DB...`);
        const { data: videoData, error } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (error || !videoData) {
            console.error(`${apiName} ❌ Video not found or DB error:`, error?.message);
            return res.status(404).json({ message: "Video not found" });
        }
        console.log(`${apiName} 🎥 Video Found: ${videoData.title} (YT: ${videoData.youtube_video_id})`);

        // 3. الاتصال بالبروكسي + الإعدادات
        console.log(`${apiName} 📡 Connecting to Python Proxy & Fetching Settings...`);
        
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        const [proxyResponse, settingResult] = await Promise.all([
            axios.get(hls_endpoint, { 
                params: { youtubeId: videoData.youtube_video_id },
                headers: proxyHeaders,
                timeout: 25000 
            }).catch(e => {
                console.error(`${apiName} ❌ Proxy Error:`, e.message);
                throw new Error("Proxy Connection Failed");
            }),
            supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
        ]);

        console.log(`${apiName} ✅ Proxy Response Received.`);
        
        const isOfflineMode = settingResult.data ? settingResult.data.value === 'true' : true;
        
        let directUrl = proxyResponse.data.url;
        if (!directUrl && proxyResponse.data.availableQualities?.length > 0) {
            directUrl = proxyResponse.data.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
            console.log(`${apiName} ℹ️ Auto-selected best quality URL.`);
        }

        console.log(`${apiName} 📤 Sending response to client.`);
        res.status(200).json({ 
            ...proxyResponse.data, 
            url: directUrl, 
            youtube_video_id: videoData.youtube_video_id,
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        console.error(`${apiName} 🔥 CRITICAL ERROR:`, err.message);
        res.status(500).json({ message: "Server Error" });
    }
};
