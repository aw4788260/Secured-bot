import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
    // إعداد اللوج لتتبع الأخطاء
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [PROXY-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    // 1. قراءة رابط البروكسي
    const PROXY_BASE_URL = process.env.PYTHON_PROXY_URL;

    if (!PROXY_BASE_URL) {
        errLog("CRITICAL: PYTHON_PROXY_BASE_URL is not defined in .env file");
        return res.status(500).json({ message: "Server Configuration Error" });
    }

    const { lessonId } = req.query;
    const userId = req.headers['x-user-id'];
    const deviceId = req.headers['x-device-id'];

    if (!lessonId || !userId || !deviceId) {
        return res.status(400).json({ message: "Missing required data" });
    }

    try {
        // =========================================================
        // 2. التحقق الأمني
        // =========================================================
        log(`Checking User: ${userId} for Video Access...`);
        
        const hasAccess = await checkUserAccess(req, lessonId, 'video');
        
        if (!hasAccess) {
            errLog("⛔ Access Denied: Unauthorized Device or Subscription.");
            return res.status(403).json({ message: "Access Denied" });
        }

        // =========================================================
        // 3. جلب بيانات الفيديو
        // =========================================================
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (vidErr || !videoData) {
            return res.status(404).json({ message: "Video not found in DB" });
        }

        const youtubeId = videoData.youtube_video_id;
        log(`🎥 Requesting Proxy for: ${videoData.title}`);

        // =========================================================
        // 4. الاتصال بالسيرفر المحلي (Python Proxy)
        // =========================================================
        try {
            const proxyResponse = await axios.get(`${PROXY_BASE_URL}/extract`, {
                params: { id: youtubeId },
                
                // 🔴 تعديل المهلة هنا:
                // 10000 = 10 ثواني (قد تكون قصيرة جداً لـ yt-dlp)
                // 60000 = 60 ثانية (الأفضل لضمان عدم حدوث Timeout)
                timeout: 60000 
            });

            const result = proxyResponse.data;

            if (!result.availableQualities || result.availableQualities.length === 0) {
                throw new Error("No streams found or extraction failed");
            }

            // =========================================================
            // 5. تجهيز الرد
            // =========================================================
            const qualities = result.availableQualities;
            const defaultUrl = qualities[0].url;
            const thumbnail = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;

            const { data: settingResult } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'offline_mode')
                .single();
            const isOfflineMode = settingResult ? settingResult.value === 'true' : true;

            return res.status(200).json({
                url: defaultUrl,
                availableQualities: qualities,
                title: videoData.title,
                thumbnail: thumbnail,
                duration: "0",
                youtube_video_id: youtubeId,
                db_video_title: videoData.title,
                subject_name: videoData.chapters?.subjects?.title || "Unknown Subject",
                chapter_name: videoData.chapters?.title || "Unknown Chapter",
                offline_mode: isOfflineMode,
                proxy_method: "local_vps_filtered"
            });

        } catch (proxyErr) {
            // تفاصيل الخطأ في اللوج
            if (proxyErr.code === 'ECONNABORTED') {
                 errLog(`VPS Proxy Timeout: Request took longer than 60s`);
                 return res.status(504).json({ message: "Proxy Timeout: Server took too long to respond" });
            }

            errLog(`VPS Proxy Error: ${proxyErr.message}`);
            
            if (proxyErr.code === 'ECONNREFUSED') {
                return res.status(502).json({ message: "Proxy Service Unreachable (Check Python Script)" });
            }
            if (proxyErr.response) {
                return res.status(502).json({ message: "VPS Extraction Failed", details: proxyErr.response.data });
            }
            return res.status(500).json({ message: "Proxy Connection Error" });
        }

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
};
