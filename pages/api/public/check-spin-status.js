import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
    const { fingerprint } = req.query;
    
    // التقاط الـ IP الخاص بالطالب بمجرد فتح الصفحة
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    if (!fingerprint) return res.status(400).json({ hasPlayed: false });

    try {
        // البحث عن البصمة أو الـ IP في قاعدة البيانات
        const { data } = await supabase
            .from('wheel_spins')
            .select('browser_fingerprint, ip_address')
            .or(`browser_fingerprint.eq.${fingerprint},ip_address.eq.${clientIp}`);

        if (data && data.length > 0) {
            // هل البصمة موجودة؟
            const hasFingerprint = data.some(spin => spin.browser_fingerprint === fingerprint);
            
            // كم مرة تم اللعب من نفس شبكة الإنترنت (الـ IP)؟
            const ipCount = data.filter(spin => spin.ip_address === clientIp).length;

            // إذا كانت البصمة مسجلة، أو تم استنفاد المحاولتين من نفس الإنترنت، نمنعه من رؤية الفورم
            if (hasFingerprint || ipCount >= 1) {
                return res.status(200).json({ hasPlayed: true });
            }
        }

        // إذا كان سليماً، نسمح له برؤية فورم الإدخال
        return res.status(200).json({ hasPlayed: false });

    } catch (error) {
        // في حال حدوث خطأ، نسمح بالمرور ليتكفل ملف spin.js بالتحقق الأساسي
        return res.status(200).json({ hasPlayed: false });
    }
}
