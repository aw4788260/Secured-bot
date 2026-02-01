import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // تفعيل اللوج لمعرفة بداية الطلب
  console.log(`🚀 [ContentAPI] Incoming Request: ${req.method}`);

  // 1. التحقق من الجلسة والصلاحيات
  const { user, error } = await requireTeacherOrAdmin(req, res);
  
  if (error) {
      console.error(`❌ [ContentAPI] Auth Failed: ${error}`);
      return; // الرد بالخطأ تم إرساله مسبقاً
  }

  const auth = {
      teacherId: user.teacherId,
      userId: user.id
  };

  console.log(`👤 [ContentAPI] Authenticated User: ${auth.userId} | TeacherID: ${auth.teacherId}`);

  // ============================================================
  // GET: جلب المحتوى (لعرضه في الجدول)
  // ============================================================
  if (req.method === 'GET') {
      console.log("📥 [ContentAPI] Fetching content tree...");
      try {
          const { data: courses, error: fetchError } = await supabase
              .from('courses')
              .select(`
                  *,
                  subjects (
                      id, title, sort_order, price,
                      chapters (
                          id, title, sort_order,
                          videos (id, title, url),
                          pdfs (id, title, file_path)
                      )
                  )
              `)
              .eq('teacher_id', auth.teacherId)
              .order('sort_order', { ascending: true });

          if (fetchError) {
              console.error("❌ [ContentAPI] DB Fetch Error:", fetchError.message);
              throw fetchError;
          }

          // ترتيب العناصر الفرعية
          courses.forEach(c => {
             if(c.subjects) c.subjects.sort((a,b) => a.sort_order - b.sort_order);
             c.subjects?.forEach(s => {
                if(s.chapters) s.chapters.sort((a,b) => a.sort_order - b.sort_order);
             });
          });

          console.log(`✅ [ContentAPI] Successfully fetched ${courses.length} courses.`);
          return res.status(200).json({ success: true, courses });

      } catch (err) {
          console.error("🔥 [ContentAPI] Critical GET Error:", err.message);
          return res.status(500).json({ error: err.message });
      }
  }

  // ============================================================
  // POST: العمليات (إضافة - تعديل - حذف)
  // ============================================================
  if (req.method === 'POST') {
      // استلام البيانات ودعم الصيغتين
      const { action, type } = req.body;
      const requestData = req.body.data || req.body.payload;

      console.log(`📝 [ContentAPI] POST Action: '${action}' | Type: '${type}'`);
      console.log(`📄 [ContentAPI] Payload:`, JSON.stringify(requestData));

      if (!requestData) {
          console.warn("⚠️ [ContentAPI] Missing data/payload in request body.");
          return res.status(400).json({ error: 'بيانات الطلب مفقودة (Missing data/payload)' });
      }

      // --------------------------------------------------------
      // دوال التحقق من الملكية
      // --------------------------------------------------------
      const checkCourseOwnership = async (courseId) => {
          if (!courseId) return false;
          const { data: course } = await supabase
              .from('courses')
              .select('teacher_id')
              .eq('id', courseId)
              .single();
          
          const isOwner = course && String(course.teacher_id) === String(auth.teacherId);
          console.log(`🛡️ [ContentAPI] Ownership Check (Course: ${courseId}): ${isOwner ? 'PASSED' : 'FAILED'}`);
          return isOwner;
      };

      const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
          console.log(`🔍 [ContentAPI] Resolving Parent for ${itemType} (Update/Delete: ${isUpdateOrDelete})...`);
          try {
            // 1. مادة (Subject)
            if (itemType === 'subjects') {
                if (!isUpdateOrDelete) return itemData.course_id;
                const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
                return subject?.course_id;
            }

            // 2. شابتر (Chapter)
            if (itemType === 'chapters') {
                if (!isUpdateOrDelete) {
                    const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.subject_id).single();
                    return subject?.course_id;
                } else {
                    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', itemData.id).single();
                    if (!chapter) { console.warn("⚠️ Chapter not found"); return null; }
                    const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
                    return subject?.course_id;
                }
            }

            // 3. فيديو أو ملف (Video/PDF)
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
              console.error("❌ [ParentLookup Error]:", e.message);
              return null;
          }
      };

      try {
        // --- 1. إضافة (Create) ---
        if (action === 'create') {
          console.log("➕ [ContentAPI] Processing CREATE...");
          let insertData = { ...requestData };
          
          if (type !== 'courses') {
              const targetCourseId = await getParentCourseId(type, insertData, false);
              console.log(`🎯 [ContentAPI] Target Course ID: ${targetCourseId}`);
              
              if (!targetCourseId || !(await checkCourseOwnership(targetCourseId))) {
                  console.warn("⛔ [ContentAPI] Access Denied: Not the course owner.");
                  return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا المسار.' });
              }
          } else {
              insertData.teacher_id = auth.teacherId;
              insertData.sort_order = 999; 
              if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
          }
          
          if (type !== 'courses') insertData.sort_order = 999;
          
          const { data: newItem, error } = await supabase.from(type).insert(insertData).select().single();

          if (error) {
              console.error("❌ [ContentAPI] Insert Failed:", error.message);
              throw error;
          }
          
          console.log(`✅ [ContentAPI] Created successfully. New ID: ${newItem.id}`);

          // صلاحيات الكورس الجديد
          if (type === 'courses' && newItem) {
             const accessList = [{ user_id: auth.userId, course_id: newItem.id }];
             await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' }).catch(e => console.error(e));
          }

          return res.status(200).json({ success: true, item: newItem });
        }

        // --- 2. تعديل (Update) ---
        if (action === 'update') {
           console.log("✏️ [ContentAPI] Processing UPDATE...");
           const { id, ...updates } = requestData;
           let isAuthorized = false;

           if (!id) {
               console.error("❌ [ContentAPI] Update Failed: ID missing.");
               return res.status(400).json({ error: 'ID مطلوب للتعديل' });
           }

           if (type === 'courses') {
               const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
               if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
           } else {
               const targetCourseId = await getParentCourseId(type, { id }, true);
               if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
           }

           if (!isAuthorized) {
               console.warn(`⛔ [ContentAPI] Update Denied for user ${auth.userId} on ${type}:${id}`);
               return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا المحتوى.' });
           }

           const { error } = await supabase.from(type).update(updates).eq('id', id);
           
           if (error) {
               console.error("❌ [ContentAPI] Update DB Error:", error.message);
               throw error;
           }
           
           console.log(`✅ [ContentAPI] Updated ${type}:${id} successfully.`);
           return res.status(200).json({ success: true });
        }

        // --- 3. حذف (Delete) ---
        if (action === 'delete') {
           console.log("🗑️ [ContentAPI] Processing DELETE...");
           const { id } = requestData;
           let isAuthorized = false;
           
           if (!id) return res.status(400).json({ error: 'ID مطلوب للحذف' });

           if (type === 'courses') {
               const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
               if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
           } else {
               const targetCourseId = await getParentCourseId(type, { id }, true);
               if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
           }

           if (!isAuthorized) {
               console.warn(`⛔ [ContentAPI] Delete Denied for user ${auth.userId}`);
               return res.status(403).json({ error: 'لا تملك صلاحية الحذف.' });
           }

           const { error } = await supabase.from(type).delete().eq('id', id);

           if (error) {
               console.error("❌ [ContentAPI] Delete DB Error:", error.message);
               throw error;
           }
           
           console.log(`✅ [ContentAPI] Deleted ${type}:${id} successfully.`);
           return res.status(200).json({ success: true });
        }

      } catch (err) {
        console.error("🔥 [ContentAPI] EXCEPTION:", err);
        return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
