import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const { subjectId } = req.query;

  // 1. التحقق الأمني من الهوية والجهاز
  const isAuthorized = await checkUserAccess(req);
   
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Token or Device' });
  }

  // 2. استخدام المعرف الآمن
  const userId = req.headers['x-user-id'];

  if (!subjectId || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // 3. التحقق من الاشتراك (Subscription Check)
    const { data: subAccess } = await supabase
      .from('user_subject_access')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    let hasAccess = !!subAccess;

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

    // 4. جلب البيانات (✅ تم إضافة teacher_id إلى courses للتحقق من الملكية)
    const { data: subjectData, error: contentError } = await supabase
      .from('subjects')
      .select(`
        id, title, course_id,
        courses ( id, title, teacher_id ),
        chapters (
          id, title, sort_order,
          videos (id, title, sort_order, youtube_video_id), 
          pdfs (id, title, sort_order)
        ),
        exams (id, title, duration_minutes, sort_order, start_time, end_time, is_active) 
      `)
      .eq('id', subjectId)
      .single();

    if (contentError) throw contentError;

    // ✅ 4.5 معرفة ما إذا كان المستخدم الحالي هو المدرس صاحب الكورس
    const { data: currentUser } = await supabase
      .from('users')
      .select('teacher_profile_id')
      .eq('id', userId)
      .single();
      
    const isOwner = currentUser?.teacher_profile_id && 
                    String(currentUser.teacher_profile_id) === String(subjectData.courses?.teacher_id);

    // 5. جلب محاولات الطالب المكتملة (بشكل آمن)
    const safeExams = subjectData.exams || [];
    const safeChapters = subjectData.chapters || [];
    
    const examIds = safeExams.map(e => e.id);
    let attemptsMap = {}; 

    if (examIds.length > 0) {
      const { data: attempts } = await supabase
        .from('user_attempts')
        .select('id, exam_id') 
        .eq('user_id', userId)
        .in('exam_id', examIds)
        .eq('status', 'completed'); 
       
      attempts?.forEach(attempt => {
        attemptsMap[attempt.exam_id] = attempt.id;
      });
    }

    const now = new Date();

    // 6. تنسيق البيانات وترتيبها وفلترتها
    const formattedData = {
      id: subjectData.id,
      title: subjectData.title,
      course_id: subjectData.course_id,
      course_title: subjectData.courses?.title || "Unknown Course",
      
      chapters: safeChapters
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(ch => ({
          ...ch,
          videos: (ch.videos || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(v => ({
            id: v.id, title: v.title, hasId: !!v.youtube_video_id 
          })),
          pdfs: (ch.pdfs || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        })),
        
      exams: safeExams
        .filter(ex => {
            // استبعاد المعطل يدوياً
            if (ex.is_active === false) return false;

            // ✅ فلتر الوقت: إذا لم يحن الوقت، يتم إخفاؤه للجميع باستثناء المدرس المالك
            if (ex.start_time) {
                const startTime = new Date(ex.start_time);
                if (now < startTime && !isOwner) {
                    return false; 
                }
            }
            
            return true; 
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(ex => {
          const attemptId = attemptsMap[ex.id] || null;
          const isCompleted = !!attemptId;
          
          // فحص هل انتهى وقت الامتحان؟
          let isExpired = false;
          if (ex.end_time) {
              const endTime = new Date(ex.end_time);
              // إذا انتهى الوقت ولم يحل الطالب الامتحان
              if (now > endTime && !isCompleted) {
                  isExpired = true;
              }
          }

          return {
            ...ex,
            isCompleted: isCompleted, 
            isExpired: isExpired, 
            attempt_id: attemptId        
          };
        })
    };

    return res.status(200).json(formattedData);

  } catch (err) {
    console.error("Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
