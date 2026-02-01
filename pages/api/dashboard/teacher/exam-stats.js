import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
    // التحقق من صلاحية المدرس
    const { user, error } = await requireTeacherOrAdmin(req, res);
    if (error) return;

    const { examId } = req.query;
    if (!examId) return res.status(400).json({ error: 'Missing examId' });

    try {
        // 🔒 خطوة أمان إضافية: هل هذا الامتحان يخص هذا المدرس؟
        const { data: examCheck } = await supabase
            .from('exams')
            .select('id')
            .eq('id', examId)
            .eq('teacher_id', user.teacherId)
            .single();

        if (!examCheck) {
            return res.status(403).json({ error: 'غير مصرح لك برؤية إحصائيات هذا الامتحان' });
        }

        // جلب المحاولات
        const { data: attempts, error: dbError } = await supabase
            .from('user_attempts')
            .select('score, user_id, student_name_input, completed_at, percentage') 
            .eq('exam_id', examId)
            .eq('status', 'completed')
            .order('score', { ascending: false });

        if (dbError) throw dbError;

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
