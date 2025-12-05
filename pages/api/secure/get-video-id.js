import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

const PYTHON_PROXY_BASE_URL = process.env.PYTHON_PROXY_BASE_URL;

export default async (req, res) => {
    // 1. نقرأ فقط معرف الدرس من الرابط (غير حساس)
    const { lessonId } = req.query;

    if (!lessonId) return res.status(400).json({ message: "Missing lessonId" });

    try {
        // 2. التحقق الأمني (نمرر req كاملة ليقوم authHelper بقراءة الهيدرز)
        const hasAccess = await checkUserAccess(req, lessonId, 'video');

        if (!hasAccess) {
            return res.status(403).json({ message: "Access Denied: Security Checks Failed" });
        }

        // 3. جلب بيانات الفيديو من قاعدة البيانات
        const { data: videoData } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (!videoData) return res.status(404).json({ message: "Video not found" });

        // 4. الاتصال بالبروكسي (Python) لجلب الرابط المباشر
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`;
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        // جلب الفيديو + إعدادات الأوفلاين بالتوازي
        const [proxyResponse, settingResult] = await Promise.all([
            axios.get(hls_endpoint, { 
                params: { youtubeId: videoData.youtube_video_id },
                headers: proxyHeaders,
                timeout: 25000 
            }),
            supabase.from('app_settings').select('value').eq('key', 'offline_mode').single()
        ]);

        const isOfflineMode = settingResult.data ? settingResult.data.value === 'true' : true;
        
        // استخراج أفضل جودة تلقائياً
        let directUrl = proxyResponse.data.url;
        if (!directUrl && proxyResponse.data.availableQualities?.length > 0) {
            directUrl = proxyResponse.data.availableQualities.sort((a, b) => b.quality - a.quality)[0].url;
        }

        // 5. الرد النهائي
        res.status(200).json({ 
            ...proxyResponse.data, 
            url: directUrl, 
            youtube_video_id: videoData.youtube_video_id,
            db_video_title: videoData.title,
            subject_name: videoData.chapters?.subjects?.title,
            chapter_name: videoData.chapters?.title,
            offline_mode: isOfflineMode 
        });

    } catch (err) {
        console.error("Video API Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};
