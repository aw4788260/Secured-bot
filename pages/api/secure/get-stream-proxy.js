import { supabase } from '../../../lib/supabaseClient';
import axios from 'axios';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const log = (msg) => console.log(`🔍 [PROXY-${reqId}] ${msg}`);
    const errLog = (msg) => console.error(`❌ [ERROR-${reqId}] ${msg}`);

    // 1. قراءة إعدادات البروكسي
    const PROXY_BASE_URL = process.env.PYTHON_PROXY_URL; 

    if (!PROXY_BASE_URL) {
        errLog("CRITICAL: PYTHON_PROXY_URL is not defined in .env file");
        return res.status(500).json({ message: "Server Config Error" });
    }

    const { lessonId } = req.query;

    if (!lessonId) {
        return res.status(400).json({ message: "Missing lessonId" });
    }

    try {
        // 2. التحقق الأمني (بوابة المرور)
        // هذا السطر يفك التوكن، يتحقق من البصمة، ويحقن x-user-id الصحيح
        const hasAccess = await checkUserAccess(req, lessonId, 'video');
        
        if (!hasAccess) {
            errLog("⛔ Access Denied or Token Invalid.");
            return res.status(403).json({ message: "Access Denied" });
        }

        // ✅ الآن فقط يمكننا قراءة User ID بأمان (لأنه تم حقنه من قبل checkUserAccess)
        const userId = req.headers['x-user-id']; 
        
        // 3. جلب البيانات من قاعدة البيانات
        const { data: videoData, error: vidErr } = await supabase
            .from('videos')
            .select('youtube_video_id, title, chapters ( title, subjects ( title ) )')
            .eq('id', lessonId)
            .single();

        if (vidErr || !videoData) {
            return res.status(404).json({ message: "Video not found in DB" });
        }

        const youtubeId = videoData.youtube_video_id;
        log(`🎥 Requesting Proxy for: ${videoData.title} (User: ${userId})`);

        // 4. الاتصال بالبروكسي المحلي (Python Microservice)
        try {
            const proxyResponse = await axios.get(`${PROXY_BASE_URL}/extract`, {
                params: { id: youtubeId },
                timeout: 90000 // مهلة 90 ثانية
            });

            const result = proxyResponse.data;

            if (!result.availableQualities || result.availableQualities.length === 0) {
                throw new Error("No streams found");
            }

            // 5. فلترة وتنقية الروابط
            let rawQualities = result.availableQualities;
            
            const uniqueQualitiesMap = new Map();
            const audioStreams = [];

            for (const stream of rawQualities) {
                if (stream.type === 'audio_only') {
                    audioStreams.push(stream);
                    continue;
                }

                const quality = stream.quality;
                const codec = (stream.vcodec || "").toLowerCase();
                
                // نفضل avc1 (H.264) لتوافقية أعلى
                if (!uniqueQualitiesMap.has(quality)) {
                    uniqueQualitiesMap.set(quality, stream);
                } else {
                    const existingStream = uniqueQualitiesMap.get(quality);
                    const existingCodec = (existingStream.vcodec || "").toLowerCase();
                    
                    if (codec.includes('avc1') && !existingCodec.includes('avc1')) {
                        uniqueQualitiesMap.set(quality, stream);
                    }
                }
            }

            // تجميع القائمة النهائية
            const filteredQualities = [
                ...Array.from(uniqueQualitiesMap.values()),
                ...audioStreams
            ];

            // 6. تجهيز الرد
            const thumbnail = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;

            const { data: settingResult } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'offline_mode')
                .single();
            const isOfflineMode = settingResult ? settingResult.value === 'true' : true;

            return res.status(200).json({
                availableQualities: filteredQualities,
                title: videoData.title,
                thumbnail: thumbnail,
                duration: "0",
                youtube_video_id: youtubeId,
                db_video_title: videoData.title,
                subject_name: videoData.chapters?.subjects?.title || "Unknown Subject",
                chapter_name: videoData.chapters?.title || "Unknown Chapter",
                offline_mode: isOfflineMode,
                proxy_method: "local_vps_filtered"
            });

        } catch (proxyErr) {
            if (proxyErr.code === 'ECONNABORTED') {
                 return res.status(504).json({ message: "Proxy Timeout" });
            }
            errLog(`VPS Proxy Error: ${proxyErr.message}`);
            
            if (proxyErr.code === 'ECONNREFUSED') {
                return res.status(502).json({ message: "Proxy Service Unreachable" });
            }
            if (proxyErr.response) {
                return res.status(502).json({ message: "VPS Extraction Failed", details: proxyErr.response.data });
            }
            return res.status(500).json({ message: "Proxy Connection Error" });
        }

    } catch (err) {
        errLog(`Critical Error: ${err.message}`);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
