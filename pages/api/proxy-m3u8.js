// pages/api/proxy-m3u8.js
import axios from 'axios';

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // 1. السيرفر بيطلب الملف من جوجل (السيرفر مفيهوش قيود CORS)
        const response = await axios.get(url, {
            responseType: 'text', // نطلب الملف كنص
            headers: {
                // محاولة خداع السيرفر كأننا متصفح عادي
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
        });

        // 2. السماح للمشغل بتاعك بقراءة الرد (CORS Headers)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

        // 3. إرسال محتوى ملف الـ m3u8 للمشغل
        res.status(200).send(response.data);

    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).json({ error: 'Failed to fetch m3u8' });
    }
}
