import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (مدرس أو أدمن)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
    console.error(`❌ [ContentAPI] Auth Failed: ${error}`);
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
      // جلب الكورسات مع كافة التفاصيل المتداخلة
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

      // تنسيق البيانات للواجهة الأمامية (Frontend Parsing)
      courses.forEach(c => {
        // ترتيب المواد
        if (c.subjects) c.subjects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        c.subjects?.forEach(s => {
          // ترتيب الشباتر
          if (s.chapters) s.chapters.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          
          s.chapters?.forEach(ch => {
            // معالجة الفيديوهات: تحويل youtube_video_id إلى url (للتوافق مع الفرونت)
            if (ch.videos) {
              ch.videos.forEach(v => {
                 v.url = v.youtube_video_id; // ✅ إضافة حقل url
              });
              ch.videos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            }
            // ترتيب ملفات PDF (اختياري)
            if (ch.pdfs) {
                ch.pdfs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
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
  // POST: تنفيذ العمليات (Create, Update, Delete)
  // ============================================================
  if (req.method === 'POST') {
    const { action, type } = req.body;
    // دعم استقبال البيانات تحت مسمى data أو payload
    let requestData = req.body.data || req.body.payload;

    if (!requestData && action !== 'delete') {
       return res.status(400).json({ error: 'بيانات الطلب مفقودة' });
    }
    
    // في حالة الحذف، قد يأتي الـ id مباشرة داخل الـ body أو داخل data
    if (action === 'delete' && !requestData) {
        requestData = { id: req.body.id };
    }

    // ✅ تحويل 'url' إلى 'youtube_video_id' قبل التعامل مع قاعدة البيانات
    if (type === 'videos' && requestData?.url) {
      requestData.youtube_video_id = requestData.url;
      delete requestData.url; 
    }

    // --------------------------------------------------------
    // دوال مساعدة للتحقق من الأمان والملكية (Security Helpers)
    // --------------------------------------------------------
    
    // 1. التحقق من أن الكورس يتبع المدرس الحالي
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

    // 2. البحث عن الكورس الأب لأي عنصر فرعي (Subject, Chapter, Video, PDF)
    const getParentCourseId = async (itemType, itemData, isUpdateOrDelete = false) => {
      try {
        // أ. إذا كان العنصر "مادة" (Subject)
        if (itemType === 'subjects') {
          if (!isUpdateOrDelete) return itemData.course_id;
          // في حالة التعديل/الحذف نحتاج لجلب course_id من الداتابيز
          const { data } = await supabase.from('subjects').select('course_id').eq('id', itemData.id).single();
          return data?.course_id;
        }

        // ب. إذا كان العنصر "شابتر" (Chapter)
        if (itemType === 'chapters') {
          let subjectId = itemData.subject_id;
          if (isUpdateOrDelete) {
             const { data } = await supabase.from('chapters').select('subject_id').eq('id', itemData.id).single();
             subjectId = data?.subject_id;
          }
          if (!subjectId) return null;
          const { data } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
          return data?.course_id;
        }

        // ج. إذا كان العنصر "فيديو" أو "ملف" (Leaf Nodes)
        if (['videos', 'pdfs'].includes(itemType)) {
           let chapterId = itemData.chapter_id;
           if (isUpdateOrDelete) {
              const { data } = await supabase.from(itemType).select('chapter_id').eq('id', itemData.id).single();
              chapterId = data?.chapter_id;
           }
           if (!chapterId) return null;
           
           const { data: chapter } = await supabase.from('chapters').select('subject_id').eq('id', chapterId).single();
           if (!chapter) return null;

           const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', chapter.subject_id).single();
           return subject?.course_id;
        }

        return null;
      } catch (e) {
        console.error("ParentLookup Error:", e.message);
        return null;
      }
    };

    try {
      // ------------------------------------------------------
      // تنفيذ عملية الإضافة (Create)
      // ------------------------------------------------------
      if (action === 'create') {
        let insertData = { ...requestData };
        
        // التحقق من الصلاحية (لغير الكورسات)
        if (type !== 'courses') {
           const targetCourseId = await getParentCourseId(type, insertData, false);
           if (!targetCourseId || !(await checkCourseOwnership(targetCourseId))) {
              return res.status(403).json({ error: 'غير مصرح لك بالإضافة في هذا الكورس.' });
           }
           // تعيين ترتيب افتراضي
           insertData.sort_order = 999;
        } else {
           // إعدادات الكورس الجديد
           insertData.teacher_id = auth.teacherId;
           insertData.sort_order = 999;
           if (!insertData.code) insertData.code = Math.floor(100000 + Math.random() * 900000);
        }

        const { data: newItem, error } = await supabase
            .from(type)
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        // منح صلاحيات تلقائية للمدرس عند إنشاء كورس جديد
        if (type === 'courses' && newItem) {
           const accessList = [{ user_id: auth.userId, course_id: newItem.id }];
           await supabase.from('user_course_access')
             .upsert(accessList, { onConflict: 'user_id, course_id' })
             .catch(e => console.error("Auto-access error:", e));
        }

        // إعادة ضبط الرد (url) للفيديوهات
        if (type === 'videos' && newItem) {
           newItem.url = newItem.youtube_video_id;
        }

        return res.status(200).json({ success: true, item: newItem });
      }

      // ------------------------------------------------------
      // تنفيذ عملية التعديل (Update)
      // ------------------------------------------------------
      if (action === 'update') {
        const { id, ...updates } = requestData;
        if (!id) return res.status(400).json({ error: 'ID مطلوب للتعديل' });

        let isAuthorized = false;

        // التحقق من الملكية
        if (type === 'courses') {
           const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
           if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
        } else {
           const targetCourseId = await getParentCourseId(type, { id }, true);
           if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا العنصر.' });

        const { error } = await supabase.from(type).update(updates).eq('id', id);
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      // ------------------------------------------------------
      // تنفيذ عملية الحذف (Delete)
      // ------------------------------------------------------
      if (action === 'delete') {
        const { id } = requestData;
        if (!id) return res.status(400).json({ error: 'ID مطلوب للحذف' });

        let isAuthorized = false;

        // التحقق من الملكية
        if (type === 'courses') {
           const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
           if (course && String(course.teacher_id) === String(auth.teacherId)) isAuthorized = true;
        } else {
           const targetCourseId = await getParentCourseId(type, { id }, true);
           if (targetCourseId && await checkCourseOwnership(targetCourseId)) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا العنصر.' });

        const { error } = await supabase.from(type).delete().eq('id', id);
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

    } catch (err) {
      console.error("API Action Error:", err.message);
      // التعامل مع أخطاء التكرار (Unique Violation)
      if (err.code === '23505') {
         return res.status(400).json({ error: 'بيانات مكررة (قد يكون الكود أو الاسم مستخدماً بالفعل).' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
