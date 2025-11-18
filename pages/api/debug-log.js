// pages/api/debug-log.js

export default function handler(req, res) {
    if (req.method === 'POST') {
        const { message, type, details } = req.body;
        
        // طباعة الوقت
        const time = new Date().toISOString();
        
        // هذه الرسالة ستظهر في Vercel Logs
        // سنضع علامة مميزة [CLIENT-DEBUG] عشان تلاقيها بسهولة
        if (type === 'error') {
            console.error(`❌ [CLIENT-DEBUG] ${time} - ${message}`, details || '');
        } else {
            console.log(`✅ [CLIENT-DEBUG] ${time} - ${message}`, details || '');
        }

        res.status(200).json({ status: 'logged' });
    } else {
        res.status(405).end();
    }
}
