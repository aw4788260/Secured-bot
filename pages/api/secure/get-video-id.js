import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [DEBUG-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    log("🚀 Start Request: get-video-id");

    const { lessonId } = req.query;
    
    if (!lessonId) {
        return res.status(400).json({ message: "Missing Lesson ID" });
    }

    // 1. التحقق الأمني الشامل (Gatekeeper)
    // نمرر الـ lessonId ونوعه 'video' ليتحقق الحارس من:
    // أ. صحة التوكن
    // ب. تطابق الجهاز
    // ج. صلاحية الجلسة في الداتابيز
    // د. امتلاك المستخدم لهذا الفيديو (اشتراك)
    log("🔒 Calling checkUserAccess()...");
    
    const hasAccess = await checkUserAccess(req, lessonId, 'video');
    
    if (!hasAccess) {
        errLog("⛔ Access Denied by System (Check Logs for Reason).");
        return res.status(403).json({ message: "Access Denied" });
    }

    // 2. استخدام البيانات الآمنة
    // الآن يمكننا الوثوق بـ x-user-id لأنه تم حقنه بواسطة authHelper
    const userId = req.headers['x-user-id'];
    log(`✅ User Authorized: ${userId}`);

    try {
        if (!PYTHON_PROXY_BASE_URL) {
            errLog("Proxy URL is missing in .env");
            return res.status(500).json({ message: "Proxy Config Error" });
        }

        // 3. جلب بيانات الفيديو
        log("🔎 Fetching video metadata...");
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (vidErr || !videoData) {
            errLog(`Video Fetch Error: ${vidErr?.message}`);
            return res.status(404).json({ message: "Video not found" });
        }
        log(`🎥 Found Video: ${videoData.title} (ID: ${videoData.youtube_video_id})`);

        // 4. الاتصال بالبروكسي
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
        log(`📡 Connecting to Proxy: ${hls_endpoint}`);
        
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        const [proxyResponse, settingResult] = await Promise.all([
            axios.get(hls_endpoint, { 
                params: { youtubeId: videoData.youtube_video_id },
                headers: proxyHeaders,
                timeout: 25000 
            }),
            supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
        ]);

        log("✅ Proxy Response Received.");

        const isOfflineMode = settingResult.data ? settingResult.data.value === 'true' : true;
        
        let directUrl = proxyResponse.data.url;
        // منطق احتياطي لاختيار أفضل جودة إذا لم يرجع رابط مباشر
        if (!directUrl && proxyResponse.data.availableQualities?.length > 0) {
            directUrl = proxyResponse.data.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
        }

        log("📤 Sending 200 OK Response to client.");
        res.status(200).json({ 
            ...proxyResponse.data, 
            url: directUrl, 
            duration: "0",
            youtube_video_id: videoData.youtube_video_id,
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        if (err.response) {
            errLog(`Proxy/Upstream Status: ${err.response.status}`);
            return res.status(err.response.status).json({ message: "Proxy Error", details: err.response.data });
        }
        res.status(500).json({ message: err.message });
    }
};
