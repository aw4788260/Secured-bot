// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    // إعداد اسم للوج لسهولة التتبع
    const apiTag = `[API: get-video-id] [IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}]`;
    const timeStart = Date.now();

    // طباعة بداية الطلب
    console.log(`🔵 ${apiTag} Started processing request...`);

    // 1. استخراج البيانات (التصحيح: القراءة من الهيدرز)
    const { lessonId } = req.query;
    const userId = req.headers['x-user-id']; // ✅ قراءة من الهيدر
    const deviceId = req.headers['x-device-id']; // ✅ قراءة من الهيدر

    console.log(`${apiTag} 📥 Inputs -> Lesson: ${lessonId} | User: ${userId} | Device: ${deviceId ? 'Present' : 'Missing'}`);

    // التحقق المبدئي
    if (!lessonId) {
        console.warn(`${apiTag} ❌ Failed: Missing lessonId`);
        return res.status(400).json({ message: "Missing data: lessonId" });
    }
    if (!userId || !deviceId) {
        console.warn(`${apiTag} ❌ Failed: Missing Identity Headers (User/Device)`);
        return res.status(400).json({ message: "Missing Auth Headers" });
    }

    try {
        if (!PYTHON_PROXY_BASE_URL) {
            console.error(`${apiTag} 🔥 Critical: Proxy URL missing in ENV`);
            return res.status(500).json({ message: "Proxy Config Error" });
        }

        // =========================================================
        // 🚀 الخطوة 1: التحقق الأمني وجلب البيانات
        // =========================================================
        console.log(`${apiTag} 🔒 Verifying access...`);
        
        // نمرر req كاملة للمحرك الأمني ليفحص الهيدرز والـ Referer
        const hasAccess = await checkUserAccess(req, lessonId, 'video');

        if (!hasAccess) {
            console.warn(`${apiTag} ⛔ Access Denied by checkUserAccess`);
            return res.status(403).json({ message: "Access Denied" });
        }
        console.log(`${apiTag} ✅ Access Verified.`);

        // جلب بيانات الفيديو
        console.log(`${apiName} 🔍 Fetching video metadata form DB...`);
        const { data: videoData, error: dbError } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (dbError || !videoData) {
            console.error(`${apiTag} ❌ Video DB Error: ${dbError?.message || 'Not found'}`);
            return res.status(404).json({ message: "Video not found" });
        }
        console.log(`${apiTag} 🎥 Video Found: ${videoData.title} (YT: ${videoData.youtube_video_id})`);

        // =========================================================
        // 🚀 الخطوة 2: الاتصال بالبروكسي
        // =========================================================
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        console.log(`${apiTag} 📡 Connecting to Proxy: ${hls_endpoint}`);

        const [proxyResponse, settingResult] = await Promise.all([
            axios.get(hls_endpoint, { 
                params: { youtubeId: videoData.youtube_video_id },
                headers: proxyHeaders,
                timeout: 25000
            }).catch(err => {
                console.error(`${apiTag} ❌ Proxy Request Failed: ${err.message}`);
                throw err; // نعيد رمي الخطأ ليمسكه الـ catch بالأسفل
            }),
            supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
        ]);

        console.log(`${apiTag} ✅ Proxy responded successfully.`);

        // تجهيز قيمة وضع الأوفلاين
        const isOfflineMode = settingResult.data ? settingResult.data.value === 'true' : true;

        // =========================================================
        // معالجة الرد
        // =========================================================
        let directUrl = proxyResponse.data.url;
        if (!directUrl && proxyResponse.data.availableQualities?.length > 0) {
            const bestQuality = proxyResponse.data.availableQualities.sort((a, b) => b.quality - a.quality)[0];
            directUrl = bestQuality.url;
            console.log(`${apiTag} ℹ️ Auto-selected best quality.`);
        }

        // استخراج المدة
        let videoDuration = "0";
        try {
            if (proxyResponse.data.availableQualities) {
                for (const q of proxyResponse.data.availableQualities) {
                    if (q.url && decodeURIComponent(q.url).includes("dur=")) {
                        const match = decodeURIComponent(q.url).match(/dur=([\d.]+)/);
                        if (match && match[1]) {
                            videoDuration = match[1];
                            break; 
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`${apiTag} ⚠️ Duration extraction failed: ${e.message}`);
        }

        const durationMs = Date.now() - timeStart;
        console.log(`${apiTag} 🚀 Finished in ${durationMs}ms. Sending response.`);

        // 5. إرجاع البيانات النهائية
        res.status(200).json({ 
            ...proxyResponse.data, 
            url: directUrl, 
            duration: videoDuration,
            youtube_video_id: videoData.youtube_video_id,
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        // =========================================================
        // 🛑 منطقة الأخطاء
        // =========================================================
        console.error(`${apiTag} 🔥 CRITICAL ERROR:`, err.message);

        if (err.response) {
            // خطأ من البروكسي
            console.error(`${apiTag} ❌ Proxy Status: ${err.response.status}`);
            return res.status(err.response.status).json({ 
                message: "Proxy Error", 
                details: err.response.data 
            });
        } else if (err.request) {
            // البروكسي لا يرد
            console.error(`${apiTag} ❌ Proxy Unreachable (Timeout/Down)`);
            return res.status(503).json({ 
                message: "Proxy Unreachable",
                details: "Proxy did not respond."
            });
        } else {
            // خطأ كود داخلي
            return res.status(500).json({ message: err.message });
        }
    }
};
