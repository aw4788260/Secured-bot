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
  // ============================================================
  const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
      // الحالة 1: التعامل مع "مادة" (Subject)
      if (itemType === 'subjects') {
          if (!isUpdateOrDelete) return itemData.course_id;
          // في حالة التعديل نجلب الكورس من قاعدة البيانات
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
              const { data: chapter } = await supabase
                  .from('chapters')
                  .select('subjects (course_id)')
                  .eq('id', chapterId)
                  .single();
              return chapter?.subjects?.course_id;
          }
      }

      return null;
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

      // إدارة الصلاحيات (كما هي)
      if (type === 'courses' && newItem) {
          try {
            const accessList = [];
            const currentUserId = auth.userId || auth.id;
            if (currentUserId) accessList.push({ user_id: currentUserId, course_id: newItem.id });
            const { data: mainTeacherUser } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'teacher').maybeSingle();
            if (mainTeacherUser && mainTeacherUser.id !== currentUserId) accessList.push({ user_id: mainTeacherUser.id, course_id: newItem.id });
            const { data: moderators } = await supabase.from('users').select('id').eq('teacher_profile_id', auth.teacherId).eq('role', 'moderator');
            if (moderators) moderators.forEach(mod => { if (!accessList.some(item => item.user_id === mod.id)) accessList.push({ user_id: mod.id, course_id: newItem.id }); });
            if (accessList.length > 0) await supabase.from('user_course_access').upsert(accessList, { onConflict: 'user_id, course_id' });
          } catch (permError) { console.error("Error granting permissions:", permError); }
      }

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) - تم الإصلاح هنا ---
    if (action === 'update') {
       const { id, ...updates } = data;
       let isAuthorized = false;

       // 1. التحقق الصريح قبل التنفيذ
       if (type === 'courses') {
           // نجلب الكورس ونتحقق من teacher_id
           const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
           if (course && course.teacher_id === auth.teacherId) {
               isAuthorized = true;
           }
       } else {
           // للعناصر الفرعية: نتتبع السلسلة لنصل للكورس الأب ونتحقق منه
           const targetCourseId = await getParentCourseId(type, { id }, true);
           if (targetCourseId && await checkCourseOwnership(targetCourseId)) {
               isAuthorized = true;
           }
       }

       // 2. إذا لم يكن مصرحاً له، نرجع خطأ 403 صريح
       if (!isAuthorized) {
           return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا المحتوى.' });
       }

       // 3. التنفيذ الآمن (بعد التأكد)
       const { error } = await supabase.from(type).update(updates).eq('id', id);
       
       if (error) throw error;
       return res.status(200).json({ success: true });
    }

    // --- حذف عنصر (Delete) - تم الإصلاح هنا ---
    if (action === 'delete') {
       const { id } = data;
       let isAuthorized = false;

       // 1. التحقق الصريح قبل التنفيذ
       if (type === 'courses') {
           const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
           if (course && course.teacher_id === auth.teacherId) {
               isAuthorized = true;
           }
       } else {
           const targetCourseId = await getParentCourseId(type, { id }, true);
           if (targetCourseId && await checkCourseOwnership(targetCourseId)) {
               isAuthorized = true;
           }
       }

       // 2. إذا لم يكن مصرحاً له، نرجع خطأ 403 صريح
       if (!isAuthorized) {
           return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا المحتوى.' });
       }

       // 3. التنفيذ الآمن
       const { error } = await supabase.from(type).delete().eq('id', id);

       if (error) throw error;
       return res.status(200).json({ success: true });
    }

  } catch (err) {
    console.error("Teacher Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
