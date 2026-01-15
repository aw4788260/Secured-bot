import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    // إنشاء معرف عشوائي للطلب لتمييزه في اللوج
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [DEBUG-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    log("🚀 Start Request: get-video-id");

    // ✅ التعديل 1: استقبال mode من التطبيق (stream أو download)
    // الافتراضي هو stream لضمان عمل المشغل القديم
    const { lessonId, mode } = req.query; 
    const requestedMode = mode === 'download' ? 'download' : 'stream';

    // طباعة الهيدرز التي وصلت للسيرفر
    const userId = req.headers['x-user-id'];
    const deviceId = req.headers['x-device-id'];
    
    log(`📥 Incoming Headers:`);
    log(`   👉 User ID: ${userId || 'MISSING'}`);
    log(`   👉 Device ID: ${deviceId || 'MISSING'}`);
    log(`   👉 Lesson ID: ${lessonId || 'MISSING'}`);
    log(`   👉 Requested Mode: ${requestedMode}`); // طباعة الوضع المطلوب

    if (!lessonId || !userId || !deviceId) {
        errLog("Stopping: Missing required data.");
        return res.status(400).json({ message: "Missing data (Check Headers)" });
    }

    try {
        if (!PYTHON_PROXY_BASE_URL) {
            errLog("Proxy URL is missing in .env");
            return res.status(500).json({ message: "Proxy Config Error" });
        }

        // =========================================================
        // 1. الفحص اليدوي للتشخيص
        // =========================================================
        log("🕵️‍♂️ Diagnostic Check (Manual Database Lookup)...");
        const { data: dbDevice, error: dbErr } = await supabase
            .from('devices')
            .select('fingerprint')
            .eq('user_id', userId)
            .single();

        if (dbErr || !dbDevice) {
            errLog(`⚠️ User ${userId} has NO registered device in DB!`);
        } else {
            if (dbDevice.fingerprint === deviceId) {
                log("   ✅ Fingerprints MATCH.");
            } else {
                errLog("   ⛔ Fingerprints DO NOT MATCH! (This is the cause)");
            }
        }

        // =========================================================
        // 2. التحقق الرسمي للصلاحيات
        // =========================================================
        log("🔒 Calling checkUserAccess()...");
        const hasAccess = await checkUserAccess(req, lessonId, 'video');
        log(`🔒 checkUserAccess returned: ${hasAccess}`);

        if (!hasAccess) {
            errLog("Access Denied by System.");
            return res.status(403).json({ message: "Access Denied" });
        }

        // =========================================================
        // 3. جلب بيانات الفيديو من قاعدة البيانات
        // =========================================================
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

        // =========================================================
        // 4. الاتصال بالبروكسي (مع تمرير Mode)
        // =========================================================
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
        log(`📡 Connecting to Proxy: ${hls_endpoint} [Mode: ${requestedMode}]`);
        
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        const [proxyResponse, settingResult] = await Promise.all([
            axios.get(hls_endpoint, { 
                params: { 
                    youtubeId: videoData.youtube_video_id,
                    mode: requestedMode // ✅ التعديل 2: تمرير الوضع للبروكسي
                },
                headers: proxyHeaders,
                timeout: 25000 
            }),
            supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
        ]);

        log("✅ Proxy Response Received.");

        const isOfflineMode = settingResult.data ? settingResult.data.value === 'true' : true;
        
        // استخراج البيانات من رد البروكسي
        const proxyData = proxyResponse.data;
        
        // منطق التعامل مع الرابط المباشر
        let directUrl = proxyData.url;

        // منطق احتياطي قديم (للتوافق فقط، البروكسي الجديد يعالج هذا بالفعل)
        if (!directUrl && proxyData.availableQualities?.length > 0 && requestedMode === 'stream') {
             // في حالة المشاهدة، إذا جاءت قائمة نأخذ الأول، ولكن البروكسي الجديد سيرسل رابطاً واحداً عادة
             directUrl = proxyData.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
        }

        log("📤 Sending 200 OK Response to client.");
        
        // إرسال الرد النهائي
        res.status(200).json({ 
            ...proxyData, // يرسل url (للمشاهدة) أو availableQualities (للتحميل)
            url: directUrl, // للتوافق مع الأكواد القديمة التي تنتظر هذا الحقل
            duration: "0", 
            youtube_video_id: videoData.youtube_video_id,
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode,
            request_mode: requestedMode // معلومة إضافية للفرونت إند للتأكد
        });

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        if (err.response) {
            errLog(`Proxy/Upstream Status: ${err.response.status}`);
            errLog(`Response Data: ${JSON.stringify(err.response.data)}`);
            return res.status(err.response.status).json({ message: "Proxy Error", details: err.response.data });
        }
        res.status(500).json({ message: err.message });
    }
};
