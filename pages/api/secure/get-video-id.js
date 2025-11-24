import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper'; // استيراد

export default async (req, res) => {
    const { lessonId, userId } = req.query; // ✅ طلب userId

    if (!lessonId || !userId) {
        return res.status(400).json({ message: "Missing lessonId or userId" });
    }

    try {
        // 1. ✅ التحقق الأمني
        const hasAccess = await checkUserAccess(userId, lessonId, null, null);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Access Denied' });
        }
        
        try {
            // 1. [تعديل] جلب تفاصيل الفيديو مع الشابتر والمادة
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
                 console.error("Supabase Error:", supabaseError);
                 return res.status(404).json({ message: "Video ID not found in database." });
            }

            const youtubeId = data.youtube_video_id;
            
            // [جديد] استخراج الأسماء
            const chapterName = data.chapters?.title || "General";
            const subjectName = data.chapters?.subjects?.title || "General";
            const dbTitle = data.title;

            // 2. طلب قائمة الجودات من البروكسي
            const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
            const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
            const flaskData = proxyResponse.data;

            // 3. دمج البيانات وإرسالها
            res.status(200).json({ 
                ...flaskData, 
                youtube_video_id: youtubeId,
                // [جديد] إرسال البيانات الهيكلية للواجهة
                db_video_title: dbTitle,
                subject_name: subjectName,
                chapter_name: chapterName
            });

        } catch (err) {
            console.error("Server fetch failed:", err.message);
            res.status(500).json({ message: "Failed to fetch video details." });
        }
    } else {
        res.status(400).json({ message: "Missing lessonId" });
    }
};
