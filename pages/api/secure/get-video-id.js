// pages/api/secure/get-video-id.js
import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = 'https://web-production-3a04a.up.railway.app';

export default async (req, res) => {
    const { lessonId, userId } = req.query;

    if (!lessonId || !userId) {
        return res.status(400).json({ message: "Missing lessonId or userId" });
    }
        
    try {
        // 1. التحقق الأمني (باستخدام الكود المضمون)
        const hasAccess = await checkUserAccess(userId, lessonId, null, null);

        if (!hasAccess) {
             return res.status(403).json({ message: "Access Denied: You do not have permission to view this video." });
        }

        // 2. جلب تفاصيل الفيديو (الاستعلام الأصلي الذي يعمل بدقة)
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

        // 3. طلب البروكسي
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
        res.status(500).json({ message: "Failed to fetch video details." });
    }
};
