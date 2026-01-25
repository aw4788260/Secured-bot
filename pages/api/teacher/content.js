import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  // auth: { userId, teacherId, role, ... }
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { action, type, data } = req.body; 

  // ============================================================
  // 🛡️ دالة مساعدة للتحقق من ملكية الكورس
  // هذه الدالة تضمن أن المعلم لا يقوم بتعديل محتوى داخل كورس لا يملكه
  // ============================================================
  const checkCourseOwnership = async (courseId) => {
      if (!courseId) return false;
      const { data: course } = await supabase
          .from('courses')
          .select('teacher_id')
          .eq('id', courseId)
          .single();
      // السماح فقط إذا كان الكورس موجوداً والمعلم هو المالك
      return course && course.teacher_id === auth.teacherId;
  };

  try {
    // --- إضافة عنصر جديد (Create) ---
    if (action === 'create') {
      let insertData = { ...data };
      
      // 🛡️ التحقق الأمني للعناصر الفرعية (فصول، ملفات، إلخ)
      if (type !== 'courses') {
          // نفترض أن البيانات المرسلة تحتوي على course_id (وهو الطبيعي للفصول والملفات)
          if (insertData.course_id) {
              const isOwner = await checkCourseOwnership(insertData.course_id);
              if (!isOwner) {
                  return res.status(403).json({ error: 'غير مسموح لك بإضافة محتوى في كورس لا تملكه.' });
              }
          }
      }

      // إذا كان كورس، نربطه بالمعلم تلقائياً لضمان الملكية
      if (type === 'courses') {
        insertData.teacher_id = auth.teacherId;
        insertData.sort_order = 999; 

        // توليد كود للكورس إذا لم يكن موجوداً
        if (!insertData.code) {
            insertData.code = Math.floor(100000 + Math.random() * 900000);
        }

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
             return res.status(400).json({ error: 'حدث تكرار في كود الكورس، يرجى المحاولة مرة أخرى.' });
          }
          throw error;
      }

      // =========================================================================
      // ✅ إدارة الصلاحيات: (المنشئ + المعلم المالك + المشرفين moderators)
      // =========================================================================
      if (type === 'courses' && newItem) {
          try {
            const accessList = [];
            const currentUserId = auth.userId || auth.id;

            // 1️⃣ إضافة المنشئ الحالي فوراً (سواء كان معلم أو مشرف)
            if (currentUserId) {
                accessList.push({ user_id: currentUserId, course_id: newItem.id });
            }

            // 2️⃣ إضافة المعلم الرئيسي (المالك)
            const { data: mainTeacherUser } = await supabase
                .from('users')
                .select('id')
                .eq('teacher_profile_id', auth.teacherId)
                .eq('role', 'teacher') 
                .maybeSingle();

            if (mainTeacherUser && mainTeacherUser.id && mainTeacherUser.id !== currentUserId) {
                accessList.push({ user_id: mainTeacherUser.id, course_id: newItem.id });
            }

            // 3️⃣ إضافة جميع المشرفين المساعدين (Moderators)
            const { data: moderators } = await supabase
                .from('users')
                .select('id')
                .eq('teacher_profile_id', auth.teacherId)
                .eq('role', 'moderator');

            if (moderators && moderators.length > 0) {
                moderators.forEach(mod => {
                    const isAlreadyAdded = accessList.some(item => item.user_id === mod.id);
                    if (!isAlreadyAdded) {
                        accessList.push({ user_id: mod.id, course_id: newItem.id });
                    }
                });
            }

            // 4️⃣ تنفيذ الإضافة الجماعية
            if (accessList.length > 0) {
                await supabase.from('user_course_access').upsert(
                    accessList, 
                    { onConflict: 'user_id, course_id' }
                );
                console.log(`✅ Permissions granted to ${accessList.length} users (Teacher & Moderators)`);
            }

          } catch (permError) {
              console.error("Error granting permissions:", permError);
          }
      }
      // =========================================================================

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) ---
    if (action === 'update') {
      const { id, ...updates } = data;

      // 🛡️ التحقق الأمني قبل التعديل
      if (type !== 'courses') {
          // يجب جلب العنصر لمعرفة الكورس الذي ينتمي إليه
          const { data: currentItem } = await supabase
              .from(type)
              .select('course_id')
              .eq('id', id)
              .single();
          
          if (currentItem && currentItem.course_id) {
              const isOwner = await checkCourseOwnership(currentItem.course_id);
              if (!isOwner) {
                  return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا العنصر لأنه يتبع كورس ليس ملكك.' });
              }
          }
      }

      let query = supabase.from(type).update(updates).eq('id', id);
      // حماية إضافية للكورسات نفسها
      if (type === 'courses') query = query.eq('teacher_id', auth.teacherId);
      
      const { error } = await query;
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // --- حذف عنصر (Delete) ---
    if (action === 'delete') {
      const { id } = data;

      // 🛡️ التحقق الأمني قبل الحذف
      if (type !== 'courses') {
          // يجب جلب العنصر لمعرفة الكورس الذي ينتمي إليه
          const { data: currentItem } = await supabase
              .from(type)
              .select('course_id')
              .eq('id', id)
              .single();

          if (currentItem && currentItem.course_id) {
              const isOwner = await checkCourseOwnership(currentItem.course_id);
              if (!isOwner) {
                  return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا العنصر لأنه يتبع كورس ليس ملكك.' });
              }
          }
      }

      let query = supabase.from(type).delete().eq('id', id);
      // حماية إضافية للكورسات نفسها
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
