import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ error: 'Missing examId' });

    try {
        // [تصحيح]: استخدام completed_at بدلاً من created_at
        const { data: attempts, error } = await supabase
            .from('user_attempts')
            .select('score, user_id, student_name_input, completed_at') 
            .eq('exam_id', examId)
            .eq('status', 'completed')
            .order('score', { ascending: false });

        if (error) {
            // إذا ما زال الخطأ يظهر، قد يكون بسبب الكاش أو الصلاحيات، لكن هذا الاستعلام صحيح بناءً على الـ SQL أعلاه
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
