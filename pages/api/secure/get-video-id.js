import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    const { lessonId, userId, deviceId } = req.query;

    if (!lessonId || !userId || !deviceId) {
        return res.status(400).json({ message: "Missing data" });
    }

    try {
        if (!PYTHON_PROXY_BASE_URL) {
            console.error("Proxy URL missing");
            return res.status(500).json({ message: "Proxy Config Error" });
        }

        // =========================================================
        // 🚀 تحسين 1: تنفيذ التحقق وجلب بيانات الفيديو بالتوازي
        // =========================================================
        const [hasAccess, videoDataResult] = await Promise.all([
            // 1. التحقق الأمني
            checkUserAccess(userId, lessonId, null, null, deviceId),
            // 2. جلب بيانات الفيديو (نحتاج youtube_id للخطوة التالية)
            supabase
                .from('videos')
                .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
                .eq('id', lessonId)
                .single()
        ]);

        // التحقق من النتائج
        if (!hasAccess) return res.status(403).json({ message: "Access Denied" });
        if (videoDataResult.error || !videoDataResult.data) return res.status(404).json({ message: "Video not found" });

        const data = videoDataResult.data;

        // =========================================================
        // 🚀 تحسين 2: الاتصال بالبروكسي + جلب الإعدادات بالتوازي
        // =========================================================
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        console.log(`📡 Connecting to Proxy: ${hls_endpoint} for Video: ${data.youtube_video_id}`);

        const [proxyResponse, settingResult] = await Promise.all([
            // أ) طلب البروكسي (مع زيادة Timeout)
            axios.get(hls_endpoint, { 
                params: { youtubeId: data.youtube_video_id },
                headers: proxyHeaders,
                timeout: 25000 // ✅ زيادة المهلة لـ 25 ثانية لتجنب أخطاء السكون
            }),
            // ب) جلب إعدادات الأوفلاين في نفس الوقت
            supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
        ]);

        // تجهيز قيمة وضع الأوفلاين
        const isOfflineMode = settingResult.data ? settingResult.data.value === 'true' : true;

        // =========================================================
        // معالجة الرد (كما هو في الكود الأصلي)
        // =========================================================
        
        // استخراج الرابط المباشر
        let directUrl = proxyResponse.data.url;
        if (!directUrl && proxyResponse.data.availableQualities && proxyResponse.data.availableQualities.length > 0) {
            const bestQuality = proxyResponse.data.availableQualities.sort((a, b) => b.quality - a.quality)[0];
            directUrl = bestQuality.url;
        }

        // ✅ استخراج المدة (الكود الأصلي السليم)
        let videoDuration = "0";
        try {
            if (proxyResponse.data.availableQualities) {
                for (const q of proxyResponse.data.availableQualities) {
                    if (q.url) {
                        const decodedUrl = decodeURIComponent(q.url);
                        if (decodedUrl.includes("dur=")) {
                            const match = decodedUrl.match(/dur=([\d.]+)/);
                            if (match && match[1]) {
                                videoDuration = match[1];
                                break; 
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to extract duration:", e);
        }

        // 5. إرجاع البيانات النهائية
        res.status(200).json({ 
            ...proxyResponse.data, 
            url: directUrl, 
            duration: videoDuration,
            youtube_video_id: data.youtube_video_id,
            db_video_title: data.title,
            subject_name: data.chapters?.subjects?.title,
            chapter_name: data.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        // =========================================================
        // 🛑 منطقة تشخيص الأخطاء التفصيلية (Debug Zone)
        // =========================================================
        
        // طباعة الخطأ كاملاً في التيرمنال
        console.error("🔥 FULL ERROR DETAILS:", err);

        if (err.response) {
            // 1. الخطأ جاء من البروكسي (البروكسي رد بكود خطأ مثل 500 أو 400)
            console.error("❌ Proxy Response Status:", err.response.status);
            console.error("❌ Proxy Response Data:", err.response.data);
            
            return res.status(err.response.status).json({ 
                message: "Proxy Error", 
                details: err.response.data 
            });

        } else if (err.request) {
            // 2. البروكسي لم يرد أصلاً (مغلق، كراش، أو انتهى الوقت)
            console.error("❌ No Response from Proxy (Crash or Timeout)");
            return res.status(503).json({ 
                message: "Proxy Unreachable (Service Unavailable)",
                details: "The python proxy did not respond in time or is down."
            });

        } else {
            // 3. خطأ في الكود نفسه (Syntax Error أو غيره)
            console.error("❌ Internal Code Error:", err.message);
            return res.status(500).json({ message: err.message });
        }
    }
};
