import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (التعديل الأساسي هنا لاستخراج user بشكل صحيح)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  
  // إذا كان هناك خطأ (مثل جلسة منتهية)، الدالة المساعدة أرسلت الرد بالفعل
  if (error) return; 

  // تجهيز متغيرات الصلاحية
  const auth = {
      teacherId: user.teacherId,
      userId: user.id,
      id: user.id
  };

  // ============================================================
  // GET: جلب المحتوى (لعرضه في الصفحة)
  // هذا الجزء هو المسؤول عن ملء الجدول في الداشبورد
  // ============================================================
  if (req.method === 'GET') {
      try {
          // جلب الكورسات الخاصة بالمدرس مع المواد والشباتر (هيكل شجري)
          // نستخدم الـ Relations لجلب المواد داخل الكورسات، والشباتر داخل المواد
          const { data: courses, error: fetchError } = await supabase
              .from('courses')
              .select(`
                  *,
                  subjects (
                      id, title, sort_order,
                      chapters (
                          id, title, sort_order
                      )
                  )
              `)
              .eq('teacher_id', auth.teacherId)
              .order('sort_order', { ascending: true });

          if (fetchError) throw fetchError;

          return res.status(200).json({ success: true, courses });
      } catch (err) {
          console.error("Content GET Error:", err);
          return res.status(500).json({ error: err.message });
      }
  }

  // ============================================================
  // POST: العمليات (إضافة - تعديل - حذف)
  // ============================================================
  if (req.method === 'POST') {
      const { action, type, data } = req.body; 

      // 🛡️ دالة مساعدة: التحقق من أن الكورس يتبع لهذا المعلم
      const checkCourseOwnership = async (courseId) => {
          if (!courseId) return false;
          const { data: course } = await supabase
              .from('courses')
              .select('teacher_id')
              .eq('id', courseId)
              .single();
          return course && course.teacher_id === auth.teacherId;
      };

      // 🛡️ دالة مساعدة: الوصول لمعرف الكورس الأب من أي عنصر فرعي
      const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
          // 1. مادة
          if (itemType === 'subjects') {
              if (!isUpdateOrDelete) return itemData.course_id;
              const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
              return subject?.course_id;
          }
          // 2. شابتر
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
          // 3. فيديو أو ملف
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
      };

      try {
        // --- إضافة عنصر جديد (Create) ---
        if (action === 'create') {
          let insertData = { ...data };
          
          // التحقق الأمني: هل يحاول الإضافة في كورس يملكه؟
          if (type !== 'courses') {
              const targetCourseId = await getParentCourseId(type, insertData, false);
              if (targetCourseId) {
                  const isOwner = await checkCourseOwnership(targetCourseId);
                  if (!isOwner) return res.status(403).json({ error: 'غير مسموح لك بالإضافة في هذا الكورس.' });
              }
          }

          // إعدادات افتراضية للكورس
          if (type === 'courses') {
            insertData.teacher_id = auth.teacherId;
            insertData.sort_order = 999; 
            if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
          } else {
            insertData.sort_order = 999;
          }
          
          const { data: newItem, error } = await supabase.from(type).insert(insertData).select().single();

          if (error) {
              if (error.code === '23505') return res.status(400).json({ error: 'تكرار في البيانات (Duplicate Code/ID)' });
              throw error;
          }

          // منح الصلاحيات تلقائياً لمنشئ الكورس
          if (type === 'courses' && newItem) {
              try {
                const accessList = [];
                const currentUserId = auth.userId;
                
                if (currentUserId) accessList.push({ user_id: currentUserId, course_id: newItem.id });
                
                // إضافة حساب الأدمن الرئيسي للمعلم (لتسهيل الإدارة)
                const { data: mainTeacherUser } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'teacher').maybeSingle();
                if (mainTeacherUser && mainTeacherUser.id !== currentUserId) {
                    accessList.push({ user_id: mainTeacherUser.id, course_id: newItem.id });
                }
                
                // إضافة المشرفين
                const { data: moderators } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'moderator');
                if (moderators) {
                    moderators.forEach(mod => { 
                        if (!accessList.some(item => item.user_id === mod.id)) {
                            accessList.push({ user_id: mod.id, course_id: newItem.id }); 
                        }
                    });
                }
                
                if (accessList.length > 0) {
                    await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' });
                }
              } catch (permError) { console.error("Error granting permissions:", permError); }
          }

          return res.status(200).json({ success: true, item: newItem });
        }

        // --- تعديل عنصر (Update) ---
        if (action === 'update') {
           const { id, ...updates } = data;
           let isAuthorized = false;

           if (type === 'courses') {
               const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
               if (course && course.teacher_id === auth.teacherId) isAuthorized = true;
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
               if (course && course.teacher_id === auth.teacherId) isAuthorized = true;
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
        console.error("Content API Error:", err);
        return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
