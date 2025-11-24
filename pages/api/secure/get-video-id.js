import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';

const PYTHON_PROXY_BASE_URL = 'https://web-production-3a04a.up.railway.app';

export default async (req, res) => {
    const { lessonId, userId } = req.query;

    if (!lessonId || !userId) {
        return res.status(400).json({ message: "Missing lessonId or userId" });
    }
        
    try {
        // 1. استعلام واحد ذكي لجلب الفيديو وكل بياناته الهرمية (شابتر -> مادة -> كورس)
        const { data: videoData, error: dbError } = await supabase
            .from('videos')
            .select(`
                youtube_video_id,
                title,
                chapters (
                    title,
                    subjects (
                        id,
                        title,
                        course_id
                    )
                )
            `)
            .eq('id', lessonId)
            .single();

        if (dbError || !videoData) {
            return res.status(404).json({ message: "Video not found." });
        }

        // استخراج المعرفات للتحقق من الصلاحية
        const subjectData = videoData.chapters?.subjects;
        const courseId = subjectData?.course_id;
        const subjectId = subjectData?.id;

        // 2. التحقق من الصلاحية (بأقل عدد استعلامات)
        let hasAccess = false;

        // أولوية 1: هل يملك الكورس كاملاً؟
        if (courseId) {
            const { data: courseAccess } = await supabase
                .from('user_course_access')
                .select('id')
                .eq('user_id', userId)
                .eq('course_id', courseId)
                .maybeSingle();
            
            if (courseAccess) hasAccess = true;
        }

        // أولوية 2: إذا لم يملك الكورس، هل يملك المادة؟
        if (!hasAccess && subjectId) {
            const { data: subjectAccess } = await supabase
                .from('user_subject_access')
                .select('id')
                .eq('user_id', userId)
                .eq('subject_id', subjectId)
                .maybeSingle();

            if (subjectAccess) hasAccess = true;
        }

        // النتيجة النهائية للتحقق
        if (!hasAccess) {
             return res.status(403).json({ message: "Access Denied" });
        }

        // 3. جلب بيانات التشغيل من البروكسي (فقط بعد التأكد من الصلاحية)
        const youtubeId = videoData.youtube_video_id;
        const dbTitle = videoData.title;
        const chapterName = videoData.chapters?.title || "General";
        const subjectName = subjectData?.title || "General";

        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
        const proxyResponse = await axios.get(hls_endpoint, { params: { youtubeId } });
        
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
