import axios from 'axios';
import stream from 'stream'; // لاستخدام الـ pipe

export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL missing' });

    try {
        const isManifest = url.includes('.m3u8') || url.includes('manifest');
        
        const response = await axios.get(url, {
            responseType: isManifest ? 'text' : 'stream', // المانيفست نص، والفيديو ستريم
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            validateStatus: false 
        });

        // إعداد الـ CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        if (isManifest && typeof response.data === 'string') {
            // --- 1. حالة المانيفست (القائمة): نعدل الروابط ---
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            const modifiedM3u8 = response.data.replace(
                /(https?:\/\/[^\s]+)/g, 
                (match) => `/api/proxy-m3u8?url=${encodeURIComponent(match)}`
            );
            res.status(200).send(modifiedM3u8);

        } else {
            // --- 2. حالة الفيديو (Segment): نمرر البيانات الثنائية ---
            // نأخذ الـ Content-Type الأصلي من جوجل
            const contentType = response.headers['content-type'] || 'video/mp2t';
            res.setHeader('Content-Type', contentType);
            
            // نستخدم الـ Pipe لتمرير التدفق مباشرة بدون تحميله بالكامل في الذاكرة
            response.data.pipe(res);
            res.status(200);
        }

    } catch (error) {
        console.error("Proxy Final Error:", error.message);
        res.status(500).json({ error: 'Failed to fetch resource' });
    }
}
