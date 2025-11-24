// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = 'https://web-production-3a04a.up.railway.app';

export default async (req, res) => {
    const { lessonId, userId } = req.query;

    // 👇 1. طباعة البيانات الواصلة للـ API
    console.log("🚀 [API: get-video-id] Called with:", { lessonId, userId });

    if (!lessonId || !userId) {
        console.log("❌ [API] Missing parameters.");
        return res.status(400).json({ message: "Missing lessonId or userId" });
    }
        
    try {
        // 👇 2. استدعاء دالة التحقق وطباعة النتيجة
        console.log("🔒 [API] Verifying access...");
        const hasAccess = await checkUserAccess(userId, lessonId, null, null);
        
        console.log("🔐 [API] Access Result:", hasAccess);

        if (!hasAccess) {
             return res.status(403).json({ message: "Access Denied: You do not have permission to view this video." });
        }

        // 3. جلب تفاصيل الفيديو (الكود الأصلي)
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
                console.error("❌ [API] Database Error or Video Not Found:", supabaseError);
                return res.status(404).json({ message: "Video ID not found in database." });
        }

        const youtubeId = data.youtube_video_id;
        
        const chapterName = data.chapters?.title || "General";
        const subjectName = data.chapters?.subjects?.title || "General";
        const dbTitle = data.title;

        // 4. طلب البروكسي
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
        const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
        const flaskData = proxyResponse.data;

        // 5. الرد بنجاح
        console.log("✅ [API] Returning video data successfully.");
        res.status(200).json({ 
            ...flaskData, 
            youtube_video_id: youtubeId,
            db_video_title: dbTitle,
            subject_name: subjectName,
            chapter_name: chapterName
        });

    } catch (err) {
        console.error("💥 [API] Server Fetch Failed:", err.message);
        res.status(500).json({ message: "Failed to fetch video details." });
    }
};
