import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';
import admin from '../../../lib/firebaseAdmin'; // ✅ استيراد أداة فايربيز لإرسال الإشعارات

// ============================================================
// 🛠️ دوال مساعدة لمعالجة فيديوهات يوتيوب
// ============================================================
const extractYouTubeID = (url) => {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : url;
};

const fetchYouTubeDetails = async (videoId) => {
  try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      
      // حماية إضافية في حال نسيان إضافة المفتاح
      if (!apiKey) {
          console.warn("⚠️ لم يتم العثور على YOUTUBE_API_KEY. تم تخطي جلب المدة.");
          return { isValid: true, duration: '00:00' };
      }

      const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,status&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.items || data.items.length === 0) {
          return { isValid: false, error: '❌ الفيديو خاص او الرابط غير صحيح' };
      }

      const video = data.items[0];

      // 1. التحقق من حالة الفيديو
      if (video.status.privacyStatus === 'private') {
          return { isValid: false, error: '❌ لا يمكن إضافة فيديو "خاص" (Private). يرجى تغييره في يوتيوب إلى "غير مدرج" (Unlisted).' };
      }

      // 2. استخراج المدة وتحويلها من صيغة ISO (PT12M30S) إلى صيغة عادية (12:30)
      const isoDuration = video.contentDetails.duration;
      const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      
      const hours = match[1] ? parseInt(match[1], 10) : 0;
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const seconds = match[3] ? parseInt(match[3], 10) : 0;

      let formattedDuration = '';
      if (hours > 0) formattedDuration += `${hours}:`;
      formattedDuration += `${hours > 0 ? minutes.toString().padStart(2, '0') : minutes}:`;
      formattedDuration += seconds.toString().padStart(2, '0');

      return { isValid: true, duration: formattedDuration };

  } catch (err) {
      console.error("YouTube API Error:", err);
      return { isValid: false, error: 'حدث خطأ أثناء الاتصال بخوادم يوتيوب للتحقق من الفيديو.' };
  }
};


export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // ✅ استقبال الخيار الخاص بالإشعارات (notifyStudents) مع باقي البيانات
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

  // ============================================================
  // 🛡️ دالة مساعدة للحصول على subject_id من chapter_id (للإشعارات)
  // ============================================================
  const getSubjectIdFromChapter = async (chapterId) => {
      if (!chapterId) return null;
      const { data: chapter } = await supabase.from('chapters').select('subject_id, subjects!inner(courses!inner(title))').eq('id', chapterId).single();
      return chapter ? { subjectId: chapter.subject_id, courseTitle: chapter.subjects?.courses?.title } : null;
  };

  try {
    // --- إضافة عنصر جديد (Create) ---
    if (action === 'create') {
      let insertData = { ...data };

      // 🚀 التحقق من الفيديو وجلب المدة إذا كان العنصر فيديو
      // تحسين: استخدمنا url أو youtube_video_id تحسباً لاختلاف مفاتيح الإرسال من التطبيق
      const videoUrl = insertData.url || insertData.youtube_video_id;
      if (type === 'videos' && videoUrl) {
          insertData.youtube_video_id = extractYouTubeID(videoUrl);
          delete insertData.url; // إزالة الـ url حتى لا يتعارض مع قاعدة البيانات
          delete insertData.notifyStudents; // إزالة خيار الإشعارات قبل الإرسال لقاعدة البيانات

          const ytCheck = await fetchYouTubeDetails(insertData.youtube_video_id);
          if (!ytCheck.isValid) {
              return res.status(400).json({ error: ytCheck.error });
          }
          
          insertData.duration = ytCheck.duration;
      }
      
      // إزالة حقل notifyStudents من البيانات إذا كان موجوداً قبل حفظه (خاص بالـ PDF أيضاً إن وُجد)
      const shouldNotify = data.notifyStudents === true || data.notifyStudents === 'true';
      if (insertData.notifyStudents !== undefined) {
          delete insertData.notifyStudents;
      }
      
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

      // ============================================================
      // ✅🚀 إرسال إشعار فوري للطلاب إذا تم تفعيل الخيار وتم حفظ العنصر
      // ============================================================
      if (shouldNotify && (type === 'videos' || type === 'pdfs')) {
          try {
              // نحتاج لجلب اسم الكورس ومعرف المادة لإرسال الإشعار للشخص الصحيح
              const subjectInfo = await getSubjectIdFromChapter(insertData.chapter_id);
              if (subjectInfo && subjectInfo.subjectId) {
                  const courseTitle = subjectInfo.courseTitle || 'تحديث جديد';
                  const itemTitle = insertData.title || 'محتوى جديد';
                  const itemTypeName = type === 'videos' ? 'فيديو جديد' : 'ملف جديد';

                  const message = {
                      notification: { title: courseTitle, body: `تم رفع ${itemTypeName}: ${itemTitle}` },
                      topic: `subject_${subjectInfo.subjectId}`, // التنبيه للمشتركين في المادة فقط
                      android: { priority: 'high', notification: { sound: 'default' } },
                      apns: { payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } } },
                      data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: 'subject', id: subjectInfo.subjectId.toString() }
                  };

                  await admin.messaging().send(message);

                  // حفظ في سجل الإشعارات
                  await supabase.from('notifications').insert({
                      title: courseTitle,
                      body: `تم رفع ${itemTypeName}: ${itemTitle}`,
                      target_type: 'subject',
                      target_id: subjectInfo.subjectId.toString(),
                      sender_role: 'teacher'
                  });
                  console.log(`✅ Notification sent successfully for new ${type}: ${itemTitle}`);
              }
          } catch (notifyErr) {
              console.error("⚠️ FCM Notify Error (Content):", notifyErr.message);
          }
      }

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) ---
    if (action === 'update') {
       const { id, ...updates } = data;
       let isAuthorized = false;

       // إزالة حقل notifyStudents من بيانات التعديل إن وُجد عن طريق الخطأ
       if (updates.notifyStudents !== undefined) delete updates.notifyStudents;

       // 🚀 التحقق من الفيديو في حالة تعديل الرابط
       const videoUrl = updates.url || updates.youtube_video_id;
       if (type === 'videos' && videoUrl) {
           updates.youtube_video_id = extractYouTubeID(videoUrl);
           delete updates.url;

           const ytCheck = await fetchYouTubeDetails(updates.youtube_video_id);
           if (!ytCheck.isValid) {
               return res.status(400).json({ error: ytCheck.error });
           }
           
           updates.duration = ytCheck.duration;
       }

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

    // --- حذف عنصر (Delete) ---
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
