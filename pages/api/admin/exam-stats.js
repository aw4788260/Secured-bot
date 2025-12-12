import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
    // 1. التحقق الأمني (تمت إضافته)
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
    if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

    // ---------------------------------------------------------

    const { examId } = req.query;
    if (!examId) return res.status(400).json({ error: 'Missing examId' });

    try {
        const { data: attempts, error } = await supabase
            .from('user_attempts')
            .select('score, user_id, student_name_input, completed_at') 
            .eq('exam_id', examId)
            .eq('status', 'completed')
            .order('score', { ascending: false });

        if (error) {
            console.error("Stats Error:", error.message);
            throw error;
        }

        const totalAttempts = attempts.length;
        const averageScore = totalAttempts > 0 
            ? (attempts.reduce((a, b) => a + (b.score || 0), 0) / totalAttempts).toFixed(1) 
            : 0;

        return res.status(200).json({
            totalAttempts,
            averageScore,
            attempts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
