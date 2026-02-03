import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

// 🛠️ دالة مساعدة لاستخراج معرف الفيديو من رابط يوتيوب
const extractYouTubeID = (url) => {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : url;
};

export default async (req, res) => {
  // 1. التحقق من الصلاحية (مدرس أو أدمن)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const auth = {
    teacherId: user.teacherId,
    userId: user.id
  };

  // ============================================================
  // GET: جلب البيانات بنظام (Lazy Loading) لتقليل الضغط
  // ============================================================
  if (req.method === 'GET') {
    const { mode, id } = req.query;

    try {
      // 🟢 الحالة 1: جلب تفاصيل امتحان محدد (شاملة الأسئلة والاختيارات)
      // يتم استدعاؤها فقط عند فتح نافذة تعديل الامتحان
      if (mode === 'exam_details') {
          if (!id) return res.status(400).json({ error: 'Exam ID required' });

          const { data: exam, error: examError } = await supabase
            .from('exams')
            .select(`
                *,
                questions (
                    id, question_text, image_file_id, sort_order,
                    options ( id, option_text, is_correct, sort_order )
                )
            `)
            .eq('id', id)
            .single();

          if (examError) throw examError;

          // ترتيب الأسئلة والاختيارات
          if (exam.questions) {
             exam.questions.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
             exam.questions.forEach(q => {
                 if(q.options) q.options.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
             });
          }

          return res.status(200).json({ success: true, exam });
      }

      // 🟡 الحالة 2: جلب تفاصيل مادة محددة (شاملة الفصول والامتحانات "بدون أسئلة")
      // يتم استدعاؤها عند النقر على المادة
      else if (mode === 'subject_details') {
          if (!id) return res.status(400).json({ error: 'Subject ID required' });

          const { data: subject, error: subError } = await supabase
            .from('subjects')
            .select(`
                *,
                chapters (
                    id, title, sort_order,
                    videos (*),
                    pdfs (id, title, file_path)
                ),
                exams (
                    id, title, duration_minutes, start_time, end_time, 
                    requires_student_name, randomize_questions, randomize_options, 
                    sort_order, is_active
                )
            `)
            .eq('id', id)
            .single();

          if (subError) throw subError;

          // ترتيب المحتوى الداخلي للمادة
          if (subject.chapters) {
              subject.chapters.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
              subject.chapters.forEach(ch => {
                  if (ch.videos) {
                      ch.videos.forEach(v => { v.url = v.youtube_video_id; });
                      ch.videos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                  }
                  if (ch.pdfs) ch.pdfs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
              });
          }
          if (subject.exams) {
              subject.exams.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          }

          return res.status(200).json({ success: true, subject });
      }

      // 🔴 الحالة 3 (الافتراضية): جلب الهيكل الأساسي (كورسات ومواد فقط)
      // يتم استدعاؤها عند فتح الصفحة لأول مرة (سريعة جداً)
      else {
          const { data: courses, error: fetchError } = await supabase
            .from('courses')
            .select(`
                *,
                subjects ( id, title, sort_order, price ) 
            `)
            .eq('teacher_id', auth.teacherId)
            .order('sort_order', { ascending: true });

          if (fetchError) throw fetchError;

          // ترتيب المواد
          courses.forEach(c => {
              if (c.subjects) c.subjects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          });

          return res.status(200).json({ success: true, courses });
      }

    } catch (err) {
      console.error("🔥 [ContentAPI] GET Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================================
  // POST: تنفيذ العمليات (Create, Update, Delete)
  // ============================================================
  if (req.method === 'POST') {
    const { action, type } = req.body;
    let data = req.body.data || req.body.payload;

    if (!data && action !== 'delete') {
       return res.status(400).json({ error: 'بيانات الطلب مفقودة' });
    }
    
    if (action === 'delete' && !data) {
        data = { id: req.body.id };
    }

    // ✅ معالجة فيديو اليوتيوب
    if (type === 'videos' && data?.url) {
      data.youtube_video_id = extractYouTubeID(data.url);
      delete data.url; 
    }

    // --------------------------------------------------------
    // 🛡️ دوال التحقق الأمنية الداخلية
    // --------------------------------------------------------
    
    const checkCourseOwnership = async (courseId) => {
      if (!courseId) return false;
      const { data: course } = await supabase
          .from('courses')
          .select('teacher_id')
          .eq('id', courseId)
          .single();
      return course && String(course.teacher_id) === String(auth.teacherId);
    };

    const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
       try {
          if (itemType === 'subjects') {
             if (!isUpdateOrDelete) return itemData.course_id;
             const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
             return subject?.course_id;
          }
          if (itemType === 'chapters') {
             let subjectId = itemData.subject_id;
             if (isUpdateOrDelete) {
                const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', itemData.id).single();
                subjectId = chapter?.subject_id;
             }
             if (subjectId) {
                const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
                return subject?.course_id;
             }
          }
          if (itemType === 'videos' || itemType === 'pdfs') {
             let chapterId = itemData.chapter_id;
             if (isUpdateOrDelete) {
                const { data: item } = await supabase.from(itemType).select('chapter_id').eq('id', itemData.id).single();
                chapterId = item?.chapter_id;
             }
             if (chapterId) {
                const { data: chapter } = await supabase.from('chapters').select('subjects (course_id)').eq('id', chapterId).single();
                return chapter?.subjects?.course_id;
             }
          }
          return null;
       } catch (e) {
          console.error("ParentLookup Error:", e.message);
          return null;
       }
    };

    try {
      // --- إضافة عنصر جديد (Create) ---
      if (action === 'create') {
        let insertData = { ...data };
        
        if (type !== 'courses') {
           const targetCourseId = await getParentCourseId(type, insertData, false);
           if (targetCourseId) {
               const isOwner = await checkCourseOwnership(targetCourseId);
               if (!isOwner) return res.status(403).json({ error: 'غير مسموح لك بالإضافة في هذا الكورس.' });
           } else {
               if (['subjects', 'chapters', 'videos', 'pdfs'].includes(type)) {
                   return res.status(400).json({ error: 'بيانات غير كافية للتحقق من الأمان.' });
               }
           }
           insertData.sort_order = 999;
        } else {
           insertData.teacher_id = auth.teacherId;
           insertData.sort_order = 999;
           if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
        }

        const { data: newItem, error } = await supabase
            .from(type)
            .insert(insertData)
            .select()
            .single();

        if (error) {
           if (error.code === '23505') return res.status(400).json({ error: 'تكرار في البيانات (Duplicate Code/ID)' });
           throw error;
        }

        // إضافة صلاحيات الفريق للكورسات الجديدة
        if (type === 'courses' && newItem) {
           let accessList = [{ user_id: auth.userId, course_id: newItem.id }];
           try {
               const { data: teamMembers } = await supabase
                 .from('users')
                 .select('id')
                 .eq('teacher_profile_id', auth.teacherId) 
                 .neq('role', 'student');

               if (teamMembers?.length > 0) {
                   teamMembers.forEach(member => {
                       if (member.id !== auth.userId) {
                           accessList.push({ user_id: member.id, course_id: newItem.id });
                       }
                   });
               }

               const { error: accessError } = await supabase
                  .from('user_course_access')
                  .upsert(accessList, { onConflict: 'user_id, course_id' });
               
               if (accessError) console.error("Auto-access error:", accessError);

           } catch (permError) { console.error("Error calculating permissions:", permError); }
        }

        if (type === 'videos' && newItem) newItem.url = newItem.youtube_video_id;

        return res.status(200).json({ success: true, item: newItem });
      }

      // --- تعديل عنصر (Update) ---
      if (action === 'update') {
         const { id, ...updates } = data;
         let isAuthorized = false;

         if (type === 'courses') {
            const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
            if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
         } else {
            const targetCourseId = await getParentCourseId(type, { id }, true);
            if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
         }

         if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا المحتوى.' });

         const { error } = await supabase.from(type).update(updates).eq('id', id);
         if (error) throw error;
         return res.status(200).json({ success: true });
      }

      // --- حذف عنصر (Delete) ---
      if (action === 'delete') {
         const { id } = data;
         let isAuthorized = false;

         if (type === 'courses') {
            const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
            if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
         } else {
            const targetCourseId = await getParentCourseId(type, { id }, true);
            if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
         }

         if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا المحتوى.' });

         const { error } = await supabase.from(type).delete().eq('id', id);
         if (error) throw error;
         return res.status(200).json({ success: true });
      }

    } catch (err) {
      console.error("API Action Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
