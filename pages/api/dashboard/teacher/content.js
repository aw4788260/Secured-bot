import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (استخدام dashboardHelper لضمان عمل الجلسة)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  
  // إذا كان هناك خطأ في الجلسة، الدالة المساعدة أرسلت الرد بالفعل
  if (error) return;

  // تجهيز كائن auth ليتوافق مع المنطق الذي طلبته
  const auth = {
      teacherId: user.teacherId,
      userId: user.id
  };

  // ============================================================
  // GET: جلب المحتوى (ضروري لعرض الجدول في الصفحة)
  // ============================================================
  if (req.method === 'GET') {
      try {
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
          return res.status(500).json({ error: err.message });
      }
  }

  // ============================================================
  // POST: العمليات (المنطق الخاص بك)
  // ============================================================
  if (req.method === 'POST') {
      const { action, type, data } = req.body; 

      // 🛡️ دالة للتحقق من ملكية الكورس
      const checkCourseOwnership = async (courseId) => {
          if (!courseId) return false;
          const { data: course } = await supabase
              .from('courses')
              .select('teacher_id')
              .eq('id', courseId)
              .single();
          // مقارنة TeacherID كـ String لضمان الدقة
          return course && String(course.teacher_id) === String(auth.teacherId);
      };

      // 🛡️ دالة لاستخراج معرف الكورس (Course ID) من العناصر الفرعية
      const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
          try {
            // الحالة 1: التعامل مع "مادة" (Subject)
            if (itemType === 'subjects') {
                if (!isUpdateOrDelete) return itemData.course_id;
                const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
                return subject?.course_id;
            }

            // الحالة 2: التعامل مع "شابتر" (Chapter)
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

            // الحالة 3: التعامل مع "فيديو" أو "ملف" (Video/PDF)
            if (itemType === 'videos' || itemType === 'pdfs') {
                let chapterId = itemData.chapter_id;
                if (isUpdateOrDelete) {
                    const { data: item } = await supabase.from(itemType).select('chapter_id').eq('id', itemData.id).single();
                    chapterId = item?.chapter_id;
                }
                if (chapterId) {
                    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', chapterId).single();
                    if (chapter?.subject_id) {
                        const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
                        return subject?.course_id;
                    }
                }
            }
            return null;
          } catch (e) {
              console.error("Parent ID Lookup Error:", e);
              return null;
          }
      };

      try {
        // --- إضافة عنصر جديد (Create) ---
        if (action === 'create') {
          let insertData = { ...data };
          
          // 🛡️ التحقق الأمني عند الإضافة
          if (type !== 'courses') {
              const targetCourseId = await getParentCourseId(type, insertData, false);

              if (targetCourseId) {
                  const isOwner = await checkCourseOwnership(targetCourseId);
                  if (!isOwner) {
                      return res.status(403).json({ error: 'غير مسموح لك بالإضافة في هذا الكورس.' });
                  }
              } else {
                   // إذا لم نستطع تحديد الكورس (بيانات ناقصة)
                   if (['subjects', 'chapters', 'videos', 'pdfs'].includes(type)) {
                       return res.status(400).json({ error: 'بيانات غير كافية للتحقق من الأمان.' });
                   }
              }
          }

          // إعدادات الكورس الجديد
          if (type === 'courses') {
            insertData.teacher_id = auth.teacherId;
            insertData.sort_order = 999; 
            if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
          } else {
            insertData.sort_order = 999;
          }
          
          const { data: newItem, error } = await supabase
            .from(type)
            .insert(insertData)
            .select()
            .single();

          if (error) {
              if (error.code === '23505') { 
                 return res.status(400).json({ error: 'تكرار في البيانات (Duplicate Code/ID)' });
              }
              throw error;
          }

          // إدارة الصلاحيات التلقائية
          if (type === 'courses' && newItem) {
              try {
                const accessList = [];
                const currentUserId = auth.userId;
                if (currentUserId) accessList.push({ user_id: currentUserId, course_id: newItem.id });
                
                // إضافة حساب المعلم الرئيسي
                const { data: mainTeacherUser } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'teacher').maybeSingle();
                if (mainTeacherUser && mainTeacherUser.id !== currentUserId) accessList.push({ user_id: mainTeacherUser.id, course_id: newItem.id });
                
                // إضافة المشرفين
                const { data: moderators } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'moderator');
                if (moderators) moderators.forEach(mod => { if (!accessList.some(item => item.user_id === mod.id)) accessList.push({ user_id: mod.id, course_id: newItem.id }); });
                
                if (accessList.length > 0) await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' });
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
               if (course && String(course.teacher_id) === String(auth.teacherId)) {
                   isAuthorized = true;
               }
           } else {
               const targetCourseId = await getParentCourseId(type, { id }, true);
               if (targetCourseId && await checkCourseOwnership(targetCourseId)) {
                   isAuthorized = true;
               }
           }

           if (!isAuthorized) {
               return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا المحتوى.' });
           }

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
               if (course && String(course.teacher_id) === String(auth.teacherId)) {
                   isAuthorized = true;
               }
           } else {
               const targetCourseId = await getParentCourseId(type, { id }, true);
               if (targetCourseId && await checkCourseOwnership(targetCourseId)) {
                   isAuthorized = true;
               }
           }

           if (!isAuthorized) {
               return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا المحتوى.' });
           }

           const { error } = await supabase.from(type).delete().eq('id', id);

           if (error) throw error;
           return res.status(200).json({ success: true });
        }

      } catch (err) {
        console.error("Teacher Content API Error:", err);
        return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
