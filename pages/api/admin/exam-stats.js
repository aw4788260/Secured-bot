import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ error: 'Missing examId' });

    try {
        // جلب جميع المحاولات المكتملة
        // [تعديل]: استبدال created_at بـ completed_at أو إزالتها إذا لم تكن ضرورية للعرض
        const { data: attempts, error } = await supabase
            .from('user_attempts')
            .select('score, user_id, student_name_input, completed_at') 
            .eq('exam_id', examId)
            .eq('status', 'completed')
            .order('score', { ascending: false });

        if (error) throw error;

        const totalAttempts = attempts.length;
        const averageScore = totalAttempts > 0 
            ? (attempts.reduce((a, b) => a + b.score, 0) / totalAttempts).toFixed(1) 
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
