import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

// ==========================================================
// 🟢 GET ?survey_id=123
// يرجع: أسئلة الاستبيان + إحصائيات مجمّعة لكل سؤال (نسب الاختيارات/متوسط
// التقييم) + قائمة الردود الفردية لكل طالب (مفيدة لعرض الملاحظات الكتابية)
// ==========================================================
export default async function handler(req, res) {
  const authResult = await requireSuperAdmin(req, res);
  if (authResult?.error) return;

  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { survey_id } = req.query;
  if (!survey_id) return res.status(400).json({ success: false, message: 'survey_id مطلوب' });

  try {
    const { data: survey, error: surveyErr } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', survey_id)
      .single();
    if (surveyErr) throw surveyErr;

    const { data: questions, error: qErr } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', survey_id)
      .order('order_index', { ascending: true });
    if (qErr) throw qErr;

    const { data: responses, error: rErr } = await supabase
      .from('survey_responses')
      .select('id, user_id, submitted_at, users(first_name, phone, username)')
      .eq('survey_id', survey_id)
      .order('submitted_at', { ascending: false });
    if (rErr) throw rErr;

    const responseIds = (responses || []).map(r => r.id);

    let answers = [];
    if (responseIds.length > 0) {
      const { data: answersData, error: aErr } = await supabase
        .from('survey_answers')
        .select('*')
        .in('response_id', responseIds);
      if (aErr) throw aErr;
      answers = answersData || [];
    }

    // تجميع الردود لكل طالب على حدة (لعرض جدول تفصيلي)
    const answersByResponse = {};
    for (const a of answers) {
      if (!answersByResponse[a.response_id]) answersByResponse[a.response_id] = [];
      answersByResponse[a.response_id].push(a);
    }

    const detailedResponses = (responses || []).map(r => ({
      response_id: r.id,
      user_id: r.user_id,
      student_name: r.users?.first_name || r.users?.username || r.users?.phone || 'طالب',
      submitted_at: r.submitted_at,
      answers: (answersByResponse[r.id] || []).map(a => ({
        question_id: a.question_id,
        answer_text: a.answer_text,
        selected_options: a.selected_options,
        rating_value: a.rating_value,
      })),
    }));

    // إحصائيات مجمّعة لكل سؤال
    const stats = (questions || []).map(q => {
      const questionAnswers = answers.filter(a => a.question_id === q.id);

      if (q.question_type === 'written') {
        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          written_feedback: questionAnswers
            .filter(a => a.answer_text && a.answer_text.trim())
            .map(a => a.answer_text),
        };
      }

      if (q.question_type === 'rating') {
        const values = questionAnswers.map(a => a.rating_value).filter(v => v != null);
        const avg = values.length ? (values.reduce((s, v) => s + v, 0) / values.length) : 0;
        const distribution = {};
        for (let i = 1; i <= (q.max_rating || 5); i++) distribution[i] = 0;
        values.forEach(v => { distribution[v] = (distribution[v] || 0) + 1; });
        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          max_rating: q.max_rating || 5,
          average_rating: Math.round(avg * 100) / 100,
          total_ratings: values.length,
          distribution,
        };
      }

      // mcq_single / mcq_multiple
      const optionCounts = {};
      (q.options || []).forEach(opt => { optionCounts[opt] = 0; });
      let totalSelections = 0;
      questionAnswers.forEach(a => {
        const selected = Array.isArray(a.selected_options) ? a.selected_options : [];
        selected.forEach(opt => {
          optionCounts[opt] = (optionCounts[opt] || 0) + 1;
          totalSelections++;
        });
      });
      return {
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || [],
        option_counts: optionCounts,
        total_respondents: questionAnswers.length,
        total_selections: totalSelections,
      };
    });

    return res.status(200).json({
      success: true,
      survey,
      questions: questions || [],
      total_responses: (responses || []).length,
      stats,
      responses: detailedResponses,
    });
  } catch (err) {
    console.error('Survey Responses GET Error:', err);
    return res.status(500).json({ success: false, message: 'فشل جلب نتائج الاستبيان' });
  }
}
