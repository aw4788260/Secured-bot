import axios from 'axios';

export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL missing' });

    try {
        // هل هذا طلب لملف مانيفست (قائمة) أم فيديو فعلي؟
        const isManifest = url.includes('.m3u8') || url.includes('manifest');

        const response = await axios.get(url, {
            responseType: isManifest ? 'text' : 'stream', 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            validateStatus: false 
        });

        // إعداد الـ CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        if (isManifest && typeof response.data === 'string') {
            // --- حالة المانيفست: نعدل الروابط داخله ---
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

            const originalM3u8 = response.data;
            // البحث عن أي رابط يبدأ بـ http واستبداله برابط البروكسي
            const modifiedM3u8 = originalM3u8.replace(
                /(https?:\/\/[^\s]+)/g, 
                (match) => {
                    return `/api/proxy-m3u8?url=${encodeURIComponent(match)}`;
                }
            );
            res.status(200).send(modifiedM3u8);

        } else {
            // --- حالة الفيديو: نمرر البيانات كما هي (يستهلك باندويث) ---
            res.setHeader('Content-Type', 'video/mp2t'); // أو video/mp4 حسب النوع
            response.data.pipe(res);
        }

    } catch (error) {
        res.status(500).end();
    }
}
