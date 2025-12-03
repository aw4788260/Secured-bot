// pages/api/log-client.js
export default function handler(req, res) {
  if (req.method === 'POST') {
    const { msg, userId } = req.body;
    const time = new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Cairo' });
    
    // هذه هي الجملة التي ستظهر في PM2 Logs
    console.log(`📱 [CLIENT APP] ${time} | User: ${userId || 'Guest'} | ${msg}`);
    
    res.status(200).json({ ok: true });
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
