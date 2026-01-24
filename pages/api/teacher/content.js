import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  // auth: { teacherId, userId, role, ... }
  // إذا كان المساعد هو من يقوم بالطلب، teacherId سيعود بمعرف المعلم الرئيسي، و userId بمعرف المساعد
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { action, type, data } = req.body; 

  try {
    // --- إضافة عنصر جديد (Create) ---
    if (action === 'create') {
      let insertData = { ...data };
      
      // ربط الكورس بالمعلم الرئيسي (المالك)
      if (type === 'courses') {
        insertData.teacher_id = auth.teacherId; 
        insertData.sort_order = 999; 

        // توليد كود للكورس
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
      // ✅ إدارة الصلاحيات (للمعلم، المنشئ، والفريق)
      // =========================================================================
      if (type === 'courses' && newItem) {
          const accessList = [];

          // 1. إضافة المنشئ الحالي (سواء كان المعلم أو المشرف)
          const currentUserId = auth.userId || auth.id;
          if (currentUserId) {
              accessList.push({ user_id: currentUserId, course_id: newItem.id });
          }

          try {
            // 2. جلب معرف المستخدم الخاص بـ "المعلم الرئيسي" (لضمان حصوله على الصلاحية حتى لو أنشأه مشرف)
            // نبحث في جدول teachers لنجلب الـ user_id المرتبط بـ teacher_id هذا
            const { data: teacherData } = await supabase
                .from('teachers')
                .select('user_id') // نفترض أن جدول teachers يربط بين id المعلم و user_id الحساب
                .eq('id', auth.teacherId)
                .single();

            if (teacherData && teacherData.user_id && teacherData.user_id !== currentUserId) {
                 accessList.push({ user_id: teacherData.user_id, course_id: newItem.id });
            }

            // 3. جلب باقي فريق العمل (المشرفين الآخرين)
            const { data: teamMembers } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('teacher_id', auth.teacherId);

            if (teamMembers && teamMembers.length > 0) {
                teamMembers.forEach(member => {
                    // تجنب التكرار إذا كان المشرف هو المنشئ
                    if (member.user_id !== currentUserId) {
                        accessList.push({ user_id: member.user_id, course_id: newItem.id });
                    }
                });
            }

            // 4. تنفيذ الإضافة الجماعية (Upsert)
            if (accessList.length > 0) {
                await supabase.from('user_course_access').upsert(
                    accessList, 
                    { onConflict: 'user_id, course_id' }
                );
                console.log(`✅ Permissions granted to ${accessList.length} users (Teacher + Team).`);
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
      let query = supabase.from(type).update(updates).eq('id', id);
      if (type === 'courses') query = query.eq('teacher_id', auth.teacherId);
      const { error } = await query;
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // --- حذف عنصر (Delete) ---
    if (action === 'delete') {
      const { id } = data;
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
