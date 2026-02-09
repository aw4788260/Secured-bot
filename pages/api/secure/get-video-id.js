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

    // 1. التحقق الأمني
    const hasAccess = await checkUserAccess(req, lessonId, 'video');
    if (!hasAccess) {
        return res.status(403).json({ message: "Access Denied" });
    }

    try {
        // 2. جلب بيانات الفيديو من قاعدة البيانات (Supabase)
        // هذه الخطوة تضمن حصولنا على youtube_video_id اللازم للمشغل رقم 2
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (vidErr || !videoData) {
            return res.status(404).json({ message: "Video not found" });
        }

        // ================================================================
        // محاولة الاتصال بالبروكسي (داخل Try/Catch منفصل)
        // الهدف: إذا فشل البروكسي، لا نوقف العملية، بل نعيد الـ ID فقط
        // ================================================================
        
        let proxyResult = { url: null, availableQualities: [] };
        let isOfflineMode = true;

        try {
            if (PYTHON_PROXY_BASE_URL) {
                const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
                const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

                // تنفيذ الطلبات بالتوازي
                const [proxyResponse, settingResult] = await Promise.all([
                    axios.get(hls_endpoint, { 
                        params: { youtubeId: videoData.youtube_video_id },
                        headers: proxyHeaders,
                        timeout: 5000 // مهلة قصيرة (5 ثواني) لعدم تأخير المشغل 2
                    }),
                    supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
                ]);

                // معالجة نتيجة البروكسي
                if (proxyResponse.data) {
                    proxyResult = proxyResponse.data;
                    
                    // منطق اختيار الجودة التلقائي للمشغل 3 و 1
                    if (!proxyResult.url && proxyResult.availableQualities?.length > 0) {
                        proxyResult.url = proxyResult.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
                    }
                }

                // معالجة وضع الأوفلاين
                if (settingResult.data) {
                    isOfflineMode = settingResult.data.value === 'true';
                }
            } else {
                log("⚠️ Proxy URL missing, skipping stream fetch.");
            }
        } catch (proxyErr) {
            // ⚠️ هنا السر: إذا فشل البروكسي، نسجل الخطأ ولكن لا نوقف الكود
            errLog(`Proxy Failed (Ignored for Player 2): ${proxyErr.message}`);
        }

        // 3. إرسال الرد النهائي
        // سيحتوي دائماً على youtube_video_id حتى لو فشل البروكسي
        res.status(200).json({ 
            ...proxyResult, // قد تكون فارغة أو تحتوي على روابط
            url: proxyResult.url || null, 
            duration: "0",
            youtube_video_id: videoData.youtube_video_id, // ✅ هذا ما يحتاجه المشغل رقم 2
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
};
