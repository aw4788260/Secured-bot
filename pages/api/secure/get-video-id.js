import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

// [✅ تعديل] جلب الرابط من متغيرات البيئة بدلاً من كتابته مباشرة
const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    const { lessonId, userId } = req.query;

    if (!lessonId || !userId) {
        return res.status(400).json({ message: "Missing lessonId or userId" });
    }

    // التحقق من وجود رابط البروكسي في الإعدادات
    if (!PYTHON_PROXY_BASE_URL) {
        console.error("Server Error: PYTHON_PROXY_BASE_URL is not set.");
        return res.status(500).json({ message: "Server configuration error." });
    }
        
    try {
        // 1. التحقق الأمني
        const hasAccess = await checkUserAccess(userId, lessonId, null, null);

        if (!hasAccess) {
             return res.status(403).json({ message: "Access Denied: You do not have permission to view this video." });
        }

        // 2. جلب تفاصيل الفيديو من قاعدة البيانات
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

        // 3. طلب روابط التشغيل من البروكسي (باستخدام المتغير)
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
        
        const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
        
        // 4. الرد بالبيانات
        res.status(200).json({ 
            ...proxyResponse.data, 
            youtube_video_id: youtubeId,
            db_video_title: dbTitle,
            subject_name: subjectName,
            chapter_name: chapterName
        });

    } catch (err) {
        console.error("Proxy Error:", err.message);
        res.status(500).json({ message: "Failed to fetch video details." });
    }
};
