import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  console.log(`🚀 [ContentAPI] Request: ${req.method}`);

  // 1. التحقق من الصلاحية
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
      console.error(`❌ [ContentAPI] Auth Failed: ${error}`);
      return; 
  }

  const auth = {
      teacherId: user.teacherId,
      userId: user.id
  };

  // ============================================================
  // GET: جلب المحتوى
  // ============================================================
  if (req.method === 'GET') {
      console.log("📥 [ContentAPI] Fetching tree...");
      try {
          // التعديل: نستخدم (*) لجلب كل الأعمدة بما فيها youtube_video_id
          const { data: courses, error: fetchError } = await supabase
              .from('courses')
              .select(`
                  *,
                  subjects (
                      id, title, sort_order, price,
                      chapters (
                          id, title, sort_order,
                          videos (*),
                          pdfs (id, title, file_path)
                      )
                  )
              `)
              .eq('teacher_id', auth.teacherId)
              .order('sort_order', { ascending: true });

          if (fetchError) throw fetchError;

          // تحسين البيانات: تحويل youtube_video_id إلى url ليتوافق مع الواجهة إذا كانت تحتاجه
          courses.forEach(c => {
             if(c.subjects) c.subjects.sort((a,b) => a.sort_order - b.sort_order);
             c.subjects?.forEach(s => {
                if(s.chapters) s.chapters.sort((a,b) => a.sort_order - b.sort_order);
                s.chapters?.forEach(ch => {
                    // إضافة خاصية url للفيديوهات لتسهيل التعامل في الواجهة
                    if(ch.videos) {
                        ch.videos.forEach(v => v.url = v.youtube_video_id);
                        ch.videos.sort((a,b) => a.sort_order - b.sort_order);
                    }
                });
             });
          });

          return res.status(200).json({ success: true, courses });

      } catch (err) {
          console.error("🔥 [ContentAPI] GET Error:", err.message);
          return res.status(500).json({ error: err.message });
      }
  }

  // ============================================================
  // POST: العمليات (إضافة - تعديل - حذف)
  // ============================================================
  if (req.method === 'POST') {
      const { action, type } = req.body;
      // دعم الصيغتين (data أو payload)
      let requestData = req.body.data || req.body.payload;

      console.log(`📝 [ContentAPI] POST ${action} on ${type}`);

      if (!requestData) {
          return res.status(400).json({ error: 'بيانات الطلب مفقودة' });
      }

      // 🛠️ إصلاح هام: تحويل url إلى youtube_video_id للفيديوهات
      if (type === 'videos') {
          if (requestData.url) {
              requestData.youtube_video_id = requestData.url;
              delete requestData.url; // حذف الحقل القديم حتى لا يسبب خطأ
          }
      }

      // --------------------------------------------------------
      // دوال مساعدة (الملكية والبحث عن الأب)
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
                if (!isUpdateOrDelete) {
                    const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.subject_id).single();
                    return subject?.course_id;
                } else {
                    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', itemData.id).single();
                    if (!chapter) return null;
                    const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
                    return subject?.course_id;
                }
            }
            if (itemType === 'videos' || itemType === 'pdfs') {
                if (!isUpdateOrDelete) {
                    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', itemData.chapter_id).single();
                    if (!chapter) return null;
                    const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
                    return subject?.course_id;
                } else {
                    const { data: item } = await supabase.from(itemType).select('chapter_id').eq('id', itemData.id).single();
                    if (!item) return null;
                    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', item.chapter_id).single();
                    if (!chapter) return null;
                    const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
                    return subject?.course_id;
                }
            }
            return null;
          } catch (e) {
              console.error("ParentLookup Error:", e.message);
              return null;
          }
      };

      try {
        // --- 1. إضافة (Create) ---
        if (action === 'create') {
          let insertData = { ...requestData };
          
          if (type !== 'courses') {
              const targetCourseId = await getParentCourseId(type, insertData, false);
              if (!targetCourseId || !(await checkCourseOwnership(targetCourseId))) {
                  return res.status(403).json({ error: 'غير مصرح لك بالإضافة هنا.' });
              }
          } else {
              insertData.teacher_id = auth.teacherId;
              insertData.sort_order = 999; 
              if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
          }
          
          if (type !== 'courses') insertData.sort_order = 999;
          
          const { data: newItem, error } = await supabase.from(type).insert(insertData).select().single();

          if (error) {
              console.error("Insert Error:", error.message);
              throw error;
          }

          // صلاحيات الكورس
          if (type === 'courses' && newItem) {
             const accessList = [{ user_id: auth.userId, course_id: newItem.id }];
             await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' }).catch(e => console.error(e));
          }

          // إعادة تعيين url في الرد ليتوافق مع الواجهة
          if (type === 'videos' && newItem) {
              newItem.url = newItem.youtube_video_id;
          }

          return res.status(200).json({ success: true, item: newItem });
        }

        // --- 2. تعديل (Update) ---
        if (action === 'update') {
           const { id, ...updates } = requestData;
           let isAuthorized = false;

           if (!id) return res.status(400).json({ error: 'ID مطلوب' });

           if (type === 'courses') {
               const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
               if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
           } else {
               const targetCourseId = await getParentCourseId(type, { id }, true);
               if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
           }

           if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية التعديل.' });

           const { error } = await supabase.from(type).update(updates).eq('id', id);
           
           if (error) throw error;
           return res.status(200).json({ success: true });
        }

        // --- 3. حذف (Delete) ---
        if (action === 'delete') {
           const { id } = requestData;
           let isAuthorized = false;
           
           if (!id) return res.status(400).json({ error: 'ID مطلوب' });

           if (type === 'courses') {
               const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
               if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
           } else {
               const targetCourseId = await getParentCourseId(type, { id }, true);
               if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
           }

           if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية الحذف.' });

           const { error } = await supabase.from(type).delete().eq('id', id);

           if (error) throw error;
           return res.status(200).json({ success: true });
        }

      } catch (err) {
        console.error("API Exception:", err);
        return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
