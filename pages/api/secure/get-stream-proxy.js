// استيراد دالة المعالجة الموجودة في الملف الجديد
import getVideoIdHandler from './get-video-id';

export default async (req, res) => {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    
    console.log(`🔄 [PROXY-REDIRECT-${reqId}] Intercepted call to get-stream-proxy.`);
    console.log(`➡️  Forwarding to get-video-id for lesson: ${req.query.lessonId}`);
    
    try {
        // توجيه الطلب (req) والرد (res) بالكامل إلى ملف get-video-id
        // التطبيق سيظن أنه يكلم get-stream-proxy، لكن التنفيذ والرد سيأتي من get-video-id
        await getVideoIdHandler(req, res);
        
    } catch (err) {
        console.error(`❌ [PROXY-REDIRECT-${reqId}] Error forwarding request:`, err.message);
        
        // تأمين ضد الأخطاء لتجنب تعليق التطبيق
        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal Server Error during temporary redirect" });
        }
    }
};
