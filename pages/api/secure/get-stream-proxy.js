import getVideoIdHandler from './get-video-id';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    console.log(`🔄 [PROXY-REDIRECT-${reqId}] Intercepted call to get-stream-proxy for lesson: ${req.query.lessonId}`);

    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    const originalSend = res.send.bind(res);

    let capturedStatus = 200;
    let capturedData = null;

    res.status = (code) => {
        capturedStatus = code;
        return res;
    };

    res.json = (data) => {
        capturedData = data;
        return res;
    };

    res.send = (data) => {
        capturedData = data;
        return res;
    };

    try {
        await getVideoIdHandler(req, res);

        res.status = originalStatus;
        res.json = originalJson;
        res.send = originalSend;

        if (capturedStatus !== 200) {
            return res.status(capturedStatus).json(capturedData);
        }

        let finalQualities = [];
        
        if (capturedData && capturedData.availableQualities && capturedData.availableQualities.length > 0) {
            finalQualities = capturedData.availableQualities.map(q => ({
                quality: q.quality ? q.quality.toString() : "Auto",
                url: q.url,
                type: "video",
                vcodec: "avc1"
            }));
        } else if (capturedData && capturedData.url) {
            finalQualities.push({
                quality: "Auto",
                url: capturedData.url,
                type: "video",
                vcodec: "avc1"
            });
        }

        // ✅ [الخدعة العبقرية لتوفير الاستهلاك ومنع التداخل]:
        // نمرر للتطبيق رابط صوت "صامت" حجمه 2 كيلوبايت فقط من مستودع موثوق ومفتوح.
        // هكذا التطبيق سيتخطى شاشة التحميل، بينما سيقوم رابط الفيديو بـ Bunny بتشغيل الصوت والصورة معاً.
        finalQualities.push({
            quality: "Audio",
            url: "https://raw.githubusercontent.com/anars/blank-audio/master/1-second-of-silence.mp3",
            type: "audio_only",
            acodec: "mp3"
        });

        const formattedResponse = {
            availableQualities: finalQualities,
            title: capturedData?.db_video_title || "فيديو",
            thumbnail: capturedData?.youtube_video_id 
                ? `https://i.ytimg.com/vi/${capturedData.youtube_video_id}/maxresdefault.jpg` 
                : "",
            duration: capturedData?.duration || "0",
            youtube_video_id: capturedData?.youtube_video_id || "",
            db_video_title: capturedData?.db_video_title || "",
            subject_name: capturedData?.subject_name || "",
            chapter_name: capturedData?.chapter_name || "",
            offline_mode: capturedData?.offline_mode !== undefined ? capturedData.offline_mode : true,
            proxy_method: "bunny_stream_with_silent_audio"
        };

        console.log(`✅ [PROXY-REDIRECT-${reqId}] Optimization applied: Video with Silent Audio track injected.`);
        return res.status(200).json(formattedResponse);

    } catch (err) {
        console.error(`❌ [PROXY-REDIRECT-${reqId}] Error mapping request:`, err.message);
        
        res.status = originalStatus;
        res.json = originalJson;
        
        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal Server Error during proxy bridge" });
        }
    }
};
