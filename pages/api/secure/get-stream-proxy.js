import getVideoIdHandler from './get-video-id';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    console.log(`🔄 [PROXY-REDIRECT-${reqId}] Intercepted call to get-stream-proxy for lesson: ${req.query.lessonId}`);

    // 1. الاحتفاظ بالدوال الأصلية للرد (حتى لا يتم إرسال الرد مبكراً)
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    const originalSend = res.send.bind(res);

    let capturedStatus = 200;
    let capturedData = null;

    // 2. تزييف دوال الرد لكي نلتقط البيانات القادمة من get-video-id
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
        // 3. توجيه الطلب داخلياً إلى get-video-id (والذي سيقوم بجلب روابط Bunny والجودات)
        await getVideoIdHandler(req, res);

        // 4. استرجاع الدوال الأصلية للسيرفر لكي نتمكن من إرسال الرد النهائي
        res.status = originalStatus;
        res.json = originalJson;
        res.send = originalSend;

        // إذا حدث خطأ (مثلاً 403 Access Denied أو 404 Not Found)، نمرره كما هو
        if (capturedStatus !== 200) {
            return res.status(capturedStatus).json(capturedData);
        }

        // 5. تجهيز الجودات بالشكل القديم الذي يتوقعه التطبيق (نفس شكل بايثون)
        let finalQualities = [];
        
        if (capturedData && capturedData.availableQualities) {
            finalQualities = capturedData.availableQualities.map(q => ({
                quality: q.quality ? q.quality.toString() : "Auto",
                url: q.url,
                type: "video",     // حقل كان يرسله البايثون ويتوقعه التطبيق
                vcodec: "avc1"     // خداع التطبيق بأنه كوديك قياسي ليتخطى فلاتر الفرونت إند القديمة
            }));
        }

        // خطة بديلة: إذا لم يكن هناك جودات مقسمة، نرسل الرابط الأساسي
        if (finalQualities.length === 0 && capturedData && capturedData.url) {
            finalQualities.push({
                quality: "Auto",
                url: capturedData.url,
                type: "video",
                vcodec: "avc1"
            });
        }

        // 6. تشكيل الرد النهائي ليكون نسخة طبق الأصل من الرد القديم للبروكسي
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
            proxy_method: "bunny_stream_injected" // توضيح أن الرابط قادم من باني بطريقة محقونة
        };

        // 7. إرسال الرد للتطبيق
        console.log(`✅ [PROXY-REDIRECT-${reqId}] Successfully mapped Bunny Stream to old proxy format.`);
        return res.status(200).json(formattedResponse);

    } catch (err) {
        console.error(`❌ [PROXY-REDIRECT-${reqId}] Error mapping request:`, err.message);
        
        // استرجاع الدوال الأساسية في حالة حدوث انهيار برمجي
        res.status = originalStatus;
        res.json = originalJson;
        
        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal Server Error during proxy bridge" });
        }
    }
};
