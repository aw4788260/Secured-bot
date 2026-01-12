import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const { subjectId } = req.query;
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];

  if (!subjectId || !userId || !deviceId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // 1. التحقق من بصمة الجهاز (Security First)
    const { data: device } = await supabase
      .from('devices')
      .select('fingerprint')
      .eq('user_id', userId)
      .maybeSingle();

    if (!device || device.fingerprint !== deviceId) {
      return res.status(403).json({ error: 'Unauthorized Device' });
    }

    // 2. التحقق من الاشتراك (Subscription Check)
    // هل يملك الطالب اشتراكاً في المادة مباشرة؟
    const { data: subAccess } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    let hasAccess = !!subAccess;

    // إذا لم يملك المادة، هل يملك الكورس الأم؟
    if (!hasAccess) {
      const { data: subjectInfo } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
      if (subjectInfo && subjectInfo.course_id) {
        const { data: courseAccess } = await supabase
          .from('user_course_access')
          .select('id')
          .eq('user_id', userId)
          .eq('course_id', subjectInfo.course_id)
          .maybeSingle();
        
        if (courseAccess) hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not own this content' });
    }

    // 3. جلب "الداتا الضخمة" (Big Data Fetch)
    // نجلب المادة -> الفصول -> (الفيديوهات + ملفات PDF)
    const { data: subjectData, error: contentError } = await supabase
      .from('subjects')
      .select(`
        id, title,
        chapters (
          id, title, sort_order,
          videos (id, title, sort_order, type, youtube_video_id), 
          pdfs (id, title, sort_order)
        ),
        exams (id, title, duration_minutes, sort_order)
      `)
      .eq('id', subjectId)
      .single();

    if (contentError) throw contentError;

    // 4. التحقق من حالة الامتحانات (Solved vs Not Solved)
    // نجلب محاولات الطالب المكتملة لهذا الكورس
    const examIds = subjectData.exams.map(e => e.id);
    let solvedExamsSet = new Set();

    if (examIds.length > 0) {
      const { data: attempts } = await supabase
        .from('user_attempts')
        .select('exam_id')
        .eq('user_id', userId)
        .in('exam_id', examIds)
        .eq('status', 'completed');
      
      attempts?.forEach(a => solvedExamsSet.add(a.exam_id));
    }

    // 5. تنسيق البيانات وترتيبها
    const formattedData = {
      id: subjectData.id,
      title: subjectData.title,
      chapters: subjectData.chapters
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(ch => ({
          ...ch,
          videos: ch.videos.sort((a, b) => a.sort_order - b.sort_order).map(v => ({
            id: v.id, title: v.title, type: v.type, hasId: !!v.youtube_video_id 
          })),
          pdfs: ch.pdfs.sort((a, b) => a.sort_order - b.sort_order)
        })),
      exams: subjectData.exams
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(ex => ({
          ...ex,
          isCompleted: solvedExamsSet.has(ex.id)
        }))
    };

    return res.status(200).json(formattedData);

  } catch (err) {
    console.error("Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
