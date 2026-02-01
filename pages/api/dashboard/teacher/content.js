import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // console.log(`🚀 [ContentAPI] Received ${req.method} request`);

  // 1. التحقق من الصلاحية واستخراج بيانات المستخدم
  const { user, error } = await requireTeacherOrAdmin(req, res);
  
  if (error) {
      // console.warn("❌ [ContentAPI] Auth Failed");
      return; // الرد تم إرساله بواسطة dashboardHelper
  }

  const auth = {
      teacherId: user.teacherId,
      userId: user.id
  };

  // console.log(`👤 [ContentAPI] User: ${auth.userId}, TeacherID: ${auth.teacherId}`);

  // ============================================================
  // GET: جلب المحتوى (للعرض في الجدول)
  // ============================================================
  if (req.method === 'GET') {
      try {
          // جلب الكورسات مع المواد والشباتر
          // نستخدم علاقات بسيطة لتجنب الأخطاء
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

          if (fetchError) {
              console.error("❌ [ContentAPI] GET Error:", fetchError.message);
              throw fetchError;
          }

          // console.log(`✅ [ContentAPI] Fetched ${courses.length} courses`);
          return res.status(200).json({ success: true, courses });

      } catch (err) {
          return res.status(500).json({ error: err.message });
      }
  }

  // ============================================================
  // POST: الإضافة والتعديل والحذف
  // ============================================================
  if (req.method === 'POST') {
      const { action, type, data } = req.body; 
      // console.log(`📝 [ContentAPI] Action: ${action} | Type: ${type} | ID: ${data?.id}`);

      // --------------------------------------------------------
      // دالة 1: التحقق من ملكية الكورس (هل هذا الكورس لي؟)
      // --------------------------------------------------------
      const checkCourseOwnership = async (courseId) => {
          if (!courseId) return false;
          const { data: course } = await supabase
              .from('courses')
              .select('teacher_id')
              .eq('id', courseId)
              .single();
          // السماح فقط إذا كان teacher_id يطابق معرف المعلم الحالي
          return course && String(course.teacher_id) === String(auth.teacherId);
      };

      // --------------------------------------------------------
      // دالة 2: الوصول للكورس الأب (بشكل تسلسلي آمن)
      // --------------------------------------------------------
      const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
          try {
            // الحالة 1: التعامل مع مادة (Subject)
            if (itemType === 'subjects') {
                if (!isUpdateOrDelete) return itemData.course_id;
                // في التعديل/الحذف: نجلب الـ course_id من المادة نفسها
                const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
                return subject?.course_id;
            }

            // الحالة 2: التعامل مع شابتر (Chapter)
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

            // الحالة 3: التعامل مع فيديو أو ملف (Video/PDF)
            if (itemType === 'videos' || itemType === 'pdfs') {
                let chapterId = itemData.chapter_id;
                // إذا كان تعديل، نجلب الشابتر من العنصر نفسه أولاً
                if (isUpdateOrDelete) {
                    const { data: item } = await supabase.from(itemType).select('chapter_id').eq('id', itemData.id).single();
                    chapterId = item?.chapter_id;
                }
                // ثم نجلب المادة من الشابتر
                if (chapterId) {
                    const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', chapterId).single();
                    if (chapter?.subject_id) {
                        // ثم نجلب الكورس من المادة
                        const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
                        return subject?.course_id;
                    }
                }
            }
            return null;
          } catch (e) {
              console.error("❌ [ContentAPI] Parent Lookup Error:", e.message);
              return null;
          }
      };

      try {
        // --- 1. تنفيذ الإضافة (Create) ---
        if (action === 'create') {
          let insertData = { ...data };
          
          // تحقق أمني: إذا لم يكن كورساً جديداً، يجب التأكد من ملكية الكورس الأب
          if (type !== 'courses') {
              const targetCourseId = await getParentCourseId(type, insertData, false);
              
              if (!targetCourseId) {
                  return res.status(400).json({ error: 'لم يتم العثور على الكورس التابع لهذا العنصر.' });
              }

              const isOwner = await checkCourseOwnership(targetCourseId);
              if (!isOwner) {
                  return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا الكورس.' });
              }
          }

          // إعدادات الكورس الافتراضية
          if (type === 'courses') {
            insertData.teacher_id = auth.teacherId;
            insertData.sort_order = 999; 
            if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
          } else {
            insertData.sort_order = 999;
          }
          
          // التنفيذ
          const { data: newItem, error } = await supabase.from(type).insert(insertData).select().single();

          if (error) {
              console.error("❌ [ContentAPI] Insert Error:", error.message);
              if (error.code === '23505') return res.status(400).json({ error: 'بيانات مكررة (Duplicate ID/Code)' });
              throw error;
          }

          // منح الصلاحيات تلقائياً (للكورسات الجديدة)
          if (type === 'courses' && newItem) {
              // (نفس كود منح الصلاحيات السابق...)
              const currentUserId = auth.userId;
              const accessList = [{ user_id: currentUserId, course_id: newItem.id }];
              await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' }).catch(() => {});
          }

          return res.status(200).json({ success: true, item: newItem });
        }

        // --- 2. تنفيذ التعديل (Update) ---
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

           if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية التعديل.' });

           const { error } = await supabase.from(type).update(updates).eq('id', id);
           if (error) throw error;
           return res.status(200).json({ success: true });
        }

        // --- 3. تنفيذ الحذف (Delete) ---
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

           if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية الحذف.' });

           const { error } = await supabase.from(type).delete().eq('id', id);
           if (error) throw error;
           return res.status(200).json({ success: true });
        }

      } catch (err) {
        console.error("❌ [ContentAPI] System Error:", err);
        return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
