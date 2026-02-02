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
  // استخدمنا requireTeacherOrAdmin بدلاً من verifyTeacher للحفاظ على صلاحية دخول الأدمن للوحة التحكم
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const auth = {
    teacherId: user.teacherId,
    userId: user.id
  };

  // ============================================================
  // GET: جلب هيكل المحتوى بالكامل (Courses -> Subjects -> Chapters -> Content)
  // ============================================================
  if (req.method === 'GET') {
    try {
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

      // تنسيق البيانات للواجهة الأمامية
      courses.forEach(c => {
        if (c.subjects) c.subjects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        c.subjects?.forEach(s => {
          if (s.chapters) s.chapters.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          s.chapters?.forEach(ch => {
            if (ch.videos) {
              ch.videos.forEach(v => { v.url = v.youtube_video_id; }); // عرض الرابط
              ch.videos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            }
            if (ch.pdfs) ch.pdfs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
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
  // POST: تنفيذ العمليات (Create, Update, Delete) باستخدام المنطق الجديد
  // ============================================================
  if (req.method === 'POST') {
    const { action, type } = req.body;
    // دعم استقبال البيانات تحت مسميات مختلفة لضمان التوافق
    let data = req.body.data || req.body.payload;

    if (!data && action !== 'delete') {
       return res.status(400).json({ error: 'بيانات الطلب مفقودة' });
    }
    
    // في حالة الحذف، قد يأتي الـ id مباشرة
    if (action === 'delete' && !data) {
        data = { id: req.body.id };
    }

    // ✅ معالجة فيديو اليوتيوب (استخراج ID) قبل أي عملية
    if (type === 'videos' && data?.url) {
      data.youtube_video_id = extractYouTubeID(data.url);
      delete data.url; 
    }

    // --------------------------------------------------------
    // 🛡️ دوال التحقق الأمنية (من الكود الجديد)
    // --------------------------------------------------------
    
    // 1. التحقق من ملكية الكورس
    const checkCourseOwnership = async (courseId) => {
      if (!courseId) return false;
      const { data: course } = await supabase
          .from('courses')
          .select('teacher_id')
          .eq('id', courseId)
          .single();
      // تحويل القيم لـ String لضمان المقارنة الصحيحة
      return course && String(course.teacher_id) === String(auth.teacherId);
    };

    // 2. تتبع الكورس الأب (Parent Traversal)
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
        
        // 🛡️ التحقق الأمني
        if (type !== 'courses') {
           const targetCourseId = await getParentCourseId(type, insertData, false);
           if (targetCourseId) {
               const isOwner = await checkCourseOwnership(targetCourseId);
               if (!isOwner) return res.status(403).json({ error: 'غير مسموح لك بالإضافة في هذا الكورس.' });
           } else {
               // فشل في تحديد الكورس الأب
               if (['subjects', 'chapters', 'videos', 'pdfs'].includes(type)) {
                   return res.status(400).json({ error: 'بيانات غير كافية للتحقق من الأمان.' });
               }
           }
           insertData.sort_order = 999;
        } else {
           // إعدادات الكورس
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

        // ✅ إدارة الصلاحيات (تم دمج منطق الفريق + الإصلاح التقني)
        if (type === 'courses' && newItem) {
           let accessList = [{ user_id: auth.userId, course_id: newItem.id }];
           
           try {
               // جلب فريق العمل (المدرسين والمشرفين التابعين لهذا المدرس - غير الطلاب)
               const { data: teamMembers } = await supabase
                 .from('users')
                 .select('id')
                 .eq('teacher_id', auth.teacherId)
                 .neq('role', 'student');

               if (teamMembers?.length > 0) {
                   teamMembers.forEach(member => {
                       if (member.id !== auth.userId) {
                           accessList.push({ user_id: member.id, course_id: newItem.id });
                       }
                   });
               }

               // تنفيذ الإضافة بدون .catch لتجنب الخطأ السابق
               const { error: accessError } = await supabase
                  .from('user_course_access')
                  .upsert(accessList, { onConflict: 'user_id, course_id' });
               
               if (accessError) console.error("Auto-access error:", accessError);

           } catch (permError) { console.error("Error calculating permissions:", permError); }
        }

        // إعادة ضبط الرد (url) للفيديوهات
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
