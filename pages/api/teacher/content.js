import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { action, type, data } = req.body; 

  // ============================================================
  // 🛡️ دالة للتحقق من ملكية الكورس
  // ============================================================
  const checkCourseOwnership = async (courseId) => {
      if (!courseId) return false;
      const { data: course } = await supabase
          .from('courses')
          .select('teacher_id')
          .eq('id', courseId)
          .single();
      return course && course.teacher_id === auth.teacherId;
  };

  // ============================================================
  // 🛡️ دالة لاستخراج معرف الكورس (Course ID) من العناصر الفرعية
  // هذه الدالة تتتبع السلسلة: Video -> Chapter -> Subject -> Course
  // ============================================================
  const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
      // الحالة 1: التعامل مع "مادة" (Subject)
      // إذا كان إنشاء: الكورس موجود في البيانات المرسلة
      // إذا كان تعديل/حذف: نجلب الكورس من قاعدة البيانات
      if (itemType === 'subjects') {
          if (!isUpdateOrDelete) return itemData.course_id;
          
          const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
          return subject?.course_id;
      }

      // الحالة 2: التعامل مع "شابتر" (Chapter)
      // الشابتر يتبع مادة (Subject) -> والمادة تتبع كورس
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
      // الفيديو يتبع شابتر -> الشابتر يتبع مادة -> المادة تتبع كورس
      if (itemType === 'videos' || itemType === 'pdfs') {
          let chapterId = itemData.chapter_id;

          if (isUpdateOrDelete) {
              // ملاحظة: الجدول videos أو pdfs يجب أن يكون فيه chapter_id
              const { data: item } = await supabase.from(itemType).select('chapter_id').eq('id', itemData.id).single();
              chapterId = item?.chapter_id;
          }

          if (chapterId) {
              // نجلب المادة عبر الشابتر (Chain Look-up)
              const { data: chapter } = await supabase
                  .from('chapters')
                  .select('subjects (course_id)') // Join لجلب الكورس مباشرة
                  .eq('id', chapterId)
                  .single();
              
              // استخراج الكورس من العلاقة المتداخلة
              return chapter?.subjects?.course_id;
          }
      }

      return null;
  };

  try {
    // --- إضافة عنصر جديد (Create) ---
    if (action === 'create') {
      let insertData = { ...data };
      
      // 🛡️ التحقق الأمني العميق (Deep Security Check)
      if (type !== 'courses') {
          // محاولة معرفة الكورس الأب للعنصر المراد إضافته
          const targetCourseId = await getParentCourseId(type, insertData, false);

          if (targetCourseId) {
              const isOwner = await checkCourseOwnership(targetCourseId);
              if (!isOwner) {
                  return res.status(403).json({ 
                      error: `Violation: لا تملك صلاحية الإضافة في الكورس رقم ${targetCourseId}` 
                  });
              }
          } else {
              // إذا لم نستطع تحديد الكورس (مثلاً بيانات ناقصة)، نرفض الطلب احتياطياً
               // (إلا إذا كان النوع مدعوماً بشكل خاص)
               if (['subjects', 'chapters', 'videos', 'pdfs'].includes(type)) {
                   return res.status(400).json({ error: 'Invalid Parent ID (Missing context for security check)' });
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
          if (error.code === '23505') return res.status(400).json({ error: 'تكرار في البيانات (Duplicate Code/ID)' });
          throw error;
      }

      // إضافة الصلاحيات للكورسات الجديدة (كما هي)
      if (type === 'courses' && newItem) {
          try {
            const accessList = [];
            const currentUserId = auth.userId || auth.id;
            if (currentUserId) accessList.push({ user_id: currentUserId, course_id: newItem.id });
            
            const { data: mainTeacherUser } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'teacher').maybeSingle();
            if (mainTeacherUser && mainTeacherUser.id !== currentUserId) accessList.push({ user_id: mainTeacherUser.id, course_id: newItem.id });

            const { data: moderators } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'moderator');
            if (moderators) {
                moderators.forEach(mod => {
                    if (!accessList.some(item => item.user_id === mod.id)) accessList.push({ user_id: mod.id, course_id: newItem.id });
                });
            }
            if (accessList.length > 0) await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' });
          } catch (permError) { console.error("Error granting permissions:", permError); }
      }

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل (Update) ---
    if (action === 'update') {
       const { id, ...updates } = data;

       // 🛡️ التحقق قبل التعديل
       if (type !== 'courses') {
           const targetCourseId = await getParentCourseId(type, { id }, true);
           if (targetCourseId) {
               const isOwner = await checkCourseOwnership(targetCourseId);
               if (!isOwner) return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا العنصر.' });
           }
       }

       let query = supabase.from(type).update(updates).eq('id', id);
       if (type === 'courses') query = query.eq('teacher_id', auth.teacherId);
       
       const { error } = await query;
       if (error) throw error;
       return res.status(200).json({ success: true });
    }

    // --- حذف (Delete) ---
    if (action === 'delete') {
       const { id } = data;

       // 🛡️ التحقق قبل الحذف
       if (type !== 'courses') {
           const targetCourseId = await getParentCourseId(type, { id }, true);
           if (targetCourseId) {
               const isOwner = await checkCourseOwnership(targetCourseId);
               if (!isOwner) return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا العنصر.' });
           }
       }

       let query = supabase.from(type).delete().eq('id', id);
       if (type === 'courses') query = query.eq('teacher_id', auth.teacherId);
       
       const { error } = await query;
       if (error) throw error;
       return res.status(200).json({ success: true });
    }

  } catch (err) {
    console.error("Teacher Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
