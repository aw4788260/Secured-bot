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
        // 1. التحقق الأمني
        const hasAccess = await checkUserAccess(userId, lessonId, null, null, deviceId);
        if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

        // 2. جلب إعداد الأوفلاين
        const { data: setting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'offline_mode')
            .single();
        const isOfflineMode = setting ? setting.value === 'true' : true;

        // 3. جلب بيانات الفيديو
        const { data, error } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (error || !data) return res.status(404).json({ message: "Video not found" });

        // 4. إذا كان الأوفلاين "معطل"، نرسل الـ ID فقط (بدون بروكسي)
        if (!isOfflineMode) {
             return res.status(200).json({ 
                youtube_video_id: data.youtube_video_id,
                db_video_title: data.title,
                offline_mode: false 
            });
        }

        // 5. إذا كان الأوفلاين "مفعل"، نستخدم البروكسي
        if (!PYTHON_PROXY_BASE_URL) return res.status(500).json({ message: "Proxy Config Error" });
        
        const hls_endpoint = `${PYTHON_PROXY_BASE_URL}/api/get-hls-playlist`; 
        const proxyHeaders = process.env.PYTHON_PROXY_KEY ? { 'X-API-Key': process.env.PYTHON_PROXY_KEY } : {};

        const proxyResponse = await axios.get(hls_endpoint, { 
            params: { youtubeId: data.youtube_video_id },
            headers: proxyHeaders
        });
        
        res.status(200).json({ 
            ...proxyResponse.data, 
            youtube_video_id: data.youtube_video_id,
            db_video_title: data.title,
            subject_name: data.chapters?.subjects?.title,
            chapter_name: data.chapters?.title,
            offline_mode: true 
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
