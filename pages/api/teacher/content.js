import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';
import admin from '../../../lib/firebaseAdmin'; // ✅ استيراد أداة فايربيز لإرسال الإشعارات

// ============================================================
// 🛠️ دوال مساعدة لمعالجة فيديوهات يوتيوب
// ============================================================
const extractYouTubeID = (url) => {
  if (!url) return null;
  
  // إذا تم إدخال الـ ID مباشرة (11 حرف) بدون رابط
  if (url.length === 11 && !url.includes('/')) return url;

  // تعبير نمطي (Regex) حديث وشامل يدعم جميع روابط يوتيوب بما فيها youtu.be والروابط التي تحتوي على ?si=
  const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  
  return match ? match[1] : url;
};

// 🛠️ دالة مساعدة لحذف الفيديو فعلياً من خوادم Bunny Stream
// (نفس المنطق المستخدم في لوحة تحكم الويب — يضمن عدم بقاء فيديوهات يتيمة
//  على Bunny عند حذف فيديو مرفوع من التطبيق)
async function deleteVideoFromBunny(bunnyVideoId) {
  if (!bunnyVideoId) return;

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;

  if (!libraryId || !apiKey) {
    console.error('⚠️ [Bunny] Missing credentials for deletion');
    return;
  }

  try {
    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey, accept: 'application/json' },
    });

    if (!res.ok) {
      console.error(`⚠️ [Bunny] Failed to delete video ${bunnyVideoId}, status: ${res.status}`);
    } else {
      console.log(`✅ [Bunny] Video ${bunnyVideoId} deleted successfully from Bunny Stream.`);
    }
  } catch (err) {
    console.error('⚠️ [Bunny] Error deleting video:', err.message);
  }
}

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // ✅ استقبال الخيارات والبيانات
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
      let isBunnyVideo = false; // 👈 يُحدَّد أدناه — يُستخدم لاحقاً لتأجيل الإشعار حتى اكتمال التشفير

      // 🚀 التحقق الإجباري من الفيديو والمدة
      // ✅ ملاحظة: فيديوهات Bunny (المرفوعة كملف من التطبيق) تُحفظ مباشرة عبر
      //    /api/teacher/confirm-upload.js وليس من هنا. هذا المسار (create/videos)
      //    يبقى مخصصاً بشكل أساسي لإضافة فيديوهات بروابط يوتيوب، لكننا لا نمنع
      //    أيضاً إدخالاً يحمل bunny_video_id مباشرة لو احتاج التطبيق ذلك مستقبلاً.
      if (type === 'videos') {
          const hasBunnyId = !!insertData.bunny_video_id;
          isBunnyVideo = hasBunnyId;
          const videoUrl = insertData.url || insertData.youtube_video_id;

          if (!hasBunnyId && !videoUrl) {
              return res.status(400).json({ error: 'رابط الفيديو مطلوب.' });
          }

          if (videoUrl) {
              insertData.youtube_video_id = extractYouTubeID(videoUrl);
          }
          delete insertData.url;
          delete insertData.notifyStudents;

          // 🚨 [تحقق إجباري]: لا تتم الإضافة إلا إذا تم إرسال مدة صحيحة من التطبيق
          // (Bunny قد يرسل المدة لاحقاً تلقائياً عبر الـ Webhook بعد المعالجة)
          if (!hasBunnyId && (!insertData.duration || insertData.duration.trim() === '' || insertData.duration === '00:00')) {
              return res.status(400).json({ error: 'إرسال مدة الفيديو الفعلي إلزامي، ولا يمكن تركها فارغة أو أصفاراً.' });
          }
      }
      
      const shouldNotify = data.notifyStudents === true || data.notifyStudents === 'true';
      if (insertData.notifyStudents !== undefined) {
          delete insertData.notifyStudents;
      }

      // 🔔 فيديوهات Bunny تحتاج وقتاً للمعالجة (Encoding) قبل أن تصبح قابلة للتشغيل.
      // بدلاً من إرسال الإشعار فور الإضافة، نخزّنه كعلَم على صف الفيديو نفسه
      // ليُرسله /api/webhooks/bunny-encoding.js تلقائياً عند اكتمال التشفير فعلاً.
      if (type === 'videos' && isBunnyVideo) {
          insertData.notify_students = shouldNotify;
      }
      
      // 🛡️ التحقق الأمني
      if (type !== 'courses') {
          const targetCourseId = await getParentCourseId(type, insertData, false);

          if (targetCourseId) {
              const isOwner = await checkCourseOwnership(targetCourseId);
              if (!isOwner) {
                  return res.status(403).json({ error: 'غير مسموح لك بالإضافة في هذا الكورس.' });
              }
          } else {
               if (['subjects', 'chapters', 'videos', 'pdfs'].includes(type)) {
                   return res.status(400).json({ error: 'بيانات غير كافية للتحقق من الأمان.' });
               }
          }
      }

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

      // إرسال الإشعارات فوراً — فقط لفيديوهات يوتيوب (لا معالجة/تشفير لها) والملفات PDF.
      // فيديوهات Bunny (isBunnyVideo) تم تخزين علَم notify_students عليها أعلاه،
      // وسيُرسل الإشعار الفعلي لاحقاً من /api/webhooks/bunny-encoding.js عند الجاهزية.
      if (shouldNotify && (type === 'pdfs' || (type === 'videos' && !isBunnyVideo))) {
          try {
              const subjectInfo = await getSubjectIdFromChapter(insertData.chapter_id);
              if (subjectInfo && subjectInfo.subjectId) {
                  const courseTitle = subjectInfo.courseTitle || 'تحديث جديد';
                  const itemTitle = insertData.title || 'محتوى جديد';
                  const itemTypeName = type === 'videos' ? 'فيديو جديد' : 'ملف جديد';

                  const message = {
                      notification: { title: courseTitle, body: `تم رفع ${itemTypeName}: ${itemTitle}` },
                      topic: `subject_${subjectInfo.subjectId}`, 
                      android: { priority: 'high', notification: { sound: 'default' } },
                      apns: { payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } } },
                      data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: 'subject', id: subjectInfo.subjectId.toString() }
                  };

                  await admin.messaging().send(message);

                  await supabase.from('notifications').insert({
                      title: courseTitle,
                      body: `تم رفع ${itemTypeName}: ${itemTitle}`,
                      target_type: 'subject',
                      target_id: subjectInfo.subjectId.toString(),
                      sender_role: 'teacher'
                  });
              }
          } catch (notifyErr) {
              console.error("⚠️ FCM Notify Error:", notifyErr.message);
          }
      }

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) ---
    if (action === 'update') {
       const { id, ...updates } = data;
       let isAuthorized = false;

       if (updates.notifyStudents !== undefined) delete updates.notifyStudents;

       if (type === 'videos') {
           const videoUrl = updates.url || updates.youtube_video_id;
           if (videoUrl) {
               updates.youtube_video_id = extractYouTubeID(videoUrl);
               delete updates.url;
           }

           // 🚨 [تحقق إجباري]: التأكد من أن المدة المرسلة للتحديث صالحة
           if (updates.duration !== undefined && (updates.duration.trim() === '' || updates.duration === '00:00')) {
               return res.status(400).json({ error: 'تحديث مدة الفيديو إلزامي، ولا يمكن تركها فارغة أو أصفاراً.' });
           }
       }

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
           if (course && course.teacher_id === auth.teacherId) {
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

       // ✅ تنظيف Bunny Stream إذا كان الفيديو مرفوعاً كملف (وليس رابط يوتيوب)
       let bunnyVideoIdToDelete = null;
       if (type === 'videos') {
           const { data: videoRecord } = await supabase.from('videos').select('bunny_video_id').eq('id', id).single();
           if (videoRecord?.bunny_video_id) {
               bunnyVideoIdToDelete = videoRecord.bunny_video_id;
           }
       }

       const { error } = await supabase.from(type).delete().eq('id', id);

       if (error) throw error;

       if (type === 'videos' && bunnyVideoIdToDelete) {
           // لا ننتظر النتيجة حتى لا نؤخر الرد على التطبيق
           deleteVideoFromBunny(bunnyVideoIdToDelete);
       }

       return res.status(200).json({ success: true });
    }

  } catch (err) {
    console.error("Teacher Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
