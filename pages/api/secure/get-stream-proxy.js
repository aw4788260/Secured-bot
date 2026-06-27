import getVideoIdHandler from './get-video-id';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    console.log(`🔄 [PROXY-REDIRECT-${reqId}] Intercepted call to get-stream-proxy for lesson: ${req.query.lessonId}`);

    // 1. الاحتفاظ بالدوال الأصلية
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    const originalSend = res.send.bind(res);

    let capturedStatus = 200;
    let capturedData = null;

    // 2. اعتراض الرد لالتقاط بيانات باني ستريم
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
        // 3. توجيه الطلب داخلياً
        await getVideoIdHandler(req, res);

        // 4. استرجاع الدوال الأصلية
        res.status = originalStatus;
        res.json = originalJson;
        res.send = originalSend;

        if (capturedStatus !== 200) {
            return res.status(capturedStatus).json(capturedData);
        }

        let finalQualities = [];
        
        // 5. إعادة تشكيل الجودات لتطابق ردود بايثون القديمة بالحرف الواحد
        if (capturedData && capturedData.availableQualities && capturedData.availableQualities.length > 0) {
            finalQualities = capturedData.availableQualities.map(q => {
                // التأكد من وجود حرف p بجوار الجودة كما يتوقع التطبيق
                let qualityString = q.quality ? q.quality.toString() : "720";
                if (!qualityString.endsWith("p") && qualityString !== "Auto") {
                    qualityString += "p";
                }
                
                return {
                    quality: qualityString,
                    url: q.url,
                    type: "video",
                    vcodec: "avc1.4d401f", // كوديك قياسي متوقع
                    acodec: "mp4a.40.2",
                    ext: "mp4" // الامتداد ضروري جداً لمشغل الفيديو في فلاتر
                };
            });
        } else if (capturedData && capturedData.url) {
            finalQualities.push({
                quality: "720p",
                url: capturedData.url,
                type: "video",
                vcodec: "avc1.4d401f",
                acodec: "mp4a.40.2",
                ext: "mp4"
            });
        }

        // 6. إضافة ملف الصوت الصامت بالصيغة القديمة الدقيقة لمنع الشاشة اللانهائية
        finalQualities.push({
            quality: "tiny",
            url: "https://raw.githubusercontent.com/anars/blank-audio/master/1-second-of-silence.m4a",
            type: "audio_only",
            acodec: "mp4a.40.2",
            vcodec: "none",
            ext: "m4a" // الامتداد القديم للصوت
        });

        const ytId = capturedData?.youtube_video_id || "unknown";

        // 7. الرد النهائي المستنسخ
        const formattedResponse = {
            availableQualities: finalQualities,
            title: capturedData?.db_video_title || "فيديو",
            thumbnail: `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
            duration: capturedData?.duration || "0",
            youtube_video_id: ytId,
            db_video_title: capturedData?.db_video_title || "",
            subject_name: capturedData?.subject_name || "",
            chapter_name: capturedData?.chapter_name || "",
            offline_mode: capturedData?.offline_mode !== undefined ? capturedData.offline_mode : true,
            proxy_method: "local_vps_primary" // ⚠️ خدعة حاسمة: أعدنا نفس اسم السيرفر القديم حتى لا يرفضه التطبيق
        };

        console.log(`✅ [PROXY-REDIRECT-${reqId}] Perfect Clone Generated.`);
        return res.status(200).json(formattedResponse);

    } catch (err) {
        console.error(`❌ [PROXY-REDIRECT-${reqId}] Error:`, err.message);
        
        res.status = originalStatus;
        res.json = originalJson;
        
        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal Server Error during proxy bridge" });
        }
    }
};
