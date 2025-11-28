// pages/api/log-error.js
export default function handler(req, res) {
    if (req.method === 'POST') {
        const { errorType, errorDetails, userId, videoId, userAgent } = req.body;
        
        // هذه الرسالة ستظهر في Vercel Function Logs
        console.error("🚨 CLIENT-SIDE PLAYBACK ERROR 🚨");
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            userId,
            videoId,
            type: errorType,
            details: errorDetails,
            browser: userAgent
        }, null, 2));

        res.status(200).json({ status: 'logged' });
    } else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}
