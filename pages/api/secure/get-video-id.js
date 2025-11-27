// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

// جلب الرابط من متغيرات البيئة
const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    // 1. استقبال البيانات (بما فيها deviceId)
    const { lessonId, userId, deviceId } = req.query;

    if (!lessonId || !userId || !deviceId) {
        return res.status(400).json({ message: "Missing data (ID, User, or Device)" });
    }

    // التحقق من إعدادات السيرفر
    if (!PYTHON_PROXY_BASE_URL) {
        console.error("Server Error: PYTHON_PROXY_BASE_URL is not set.");
        return res.status(500).json({ message: "Server configuration error." });
    }
        
    try {
        // 2. التحقق الأمني (يشمل البصمة الآن)
        // نمرر deviceId كمعامل خامس
        const hasAccess = await checkUserAccess(userId, lessonId, null, null, deviceId);

        if (!hasAccess) {
             return res.status(403).json({ message: "Access Denied: Device Mismatch or No Subscription." });
        }

        // 3. جلب تفاصيل الفيديو من قاعدة البيانات
        const { data, error: supabaseError } = await supabase
            .from('videos')
            .select(`
                youtube_video_id,
                title,
                chapters (
                    title,
                    subjects (
                        title
                    )
                )
            `)
            .eq('id', lessonId)
            .single();

        if (supabaseError || !data) {
            return res.status(404).json({ message: "Video ID not found in database." });
        }

        const youtubeId = data.youtube_video_id;
        const dbTitle = data.title;
        const chapterName = data.chapters?.title || "General";
        const subjectName = data.chapters?.subjects?.title || "General";

        // 4. طلب روابط التشغيل من البروكسي
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
        
        // (اختياري: إرسال مفتاح حماية للبروكسي إذا كنت قد فعلته)
        const proxyHeaders = process.env.PYTHON_PROXY_KEY 
            ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } 
            : {};

        const proxyResponse = await axios.get(hls_endpoint, { 
            params: { youtubeId },
            headers: proxyHeaders
        });
        
        // 5. الرد بالبيانات
        res.status(200).json({ 
            ...proxyResponse.data, 
            youtube_video_id: youtubeId,
            db_video_title: dbTitle,
            subject_name: subjectName,
            chapter_name: chapterName
        });

    } catch (err) {
        console.error("API Error:", err.message);
        res.status(500).json({ message: "Failed to fetch video details." });
    }
};
