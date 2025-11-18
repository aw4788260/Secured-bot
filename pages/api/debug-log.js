export default function handler(req, res) {
    if (req.method === 'POST') {
        const { logs } = req.body; // نستقبل مصفوفة logs
        
        if (Array.isArray(logs) && logs.length > 0) {
            console.log("\n--- 📥 INCOMING LOG BATCH ---");
            logs.forEach(log => {
                const icon = log.type === 'error' ? '❌' : (log.type === 'success' ? '✅' : 'ℹ️');
                console.log(`${icon} [${log.time}] ${log.message}`, log.details ? JSON.stringify(log.details) : '');
            });
            console.log("-----------------------------\n");
        }
        res.status(200).json({ status: 'ok' });
    } else {
        res.status(405).end();
    }
}
