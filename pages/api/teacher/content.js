import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  // auth يحتوي عادة على { teacherId, userId, ... }
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { action, type, data } = req.body; 
  // action: 'create', 'update', 'delete'
  // type: 'courses', 'subjects', 'chapters', 'videos', 'pdfs'

  try {
    // --- إضافة عنصر جديد (Create) ---
    if (action === 'create') {
      let insertData = { ...data };
      
      // إذا كان كورس، نربطه بالمعلم تلقائياً لضمان الملكية
      if (type === 'courses') {
        insertData.teacher_id = auth.teacherId;
        insertData.sort_order = 999; // يضاف في النهاية بشكل افتراضي

        // ✅ [تعديل] توليد كود رقمي عشوائي مكون من 6 أرقام للكورس
        if (!insertData.code) {
            // يولد رقماً صحيحاً عشوائياً بين 100000 و 999999
            insertData.code = Math.floor(100000 + Math.random() * 900000);
        }

      } else {
        // لباقي العناصر، يجب التأكد أن الأب (الكورس/المادة) يتبع لهذا المعلم
        insertData.sort_order = 999;
      }
      
      const { data: newItem, error } = await supabase
        .from(type)
        .insert(insertData)
        .select()
        .single();

      // ✅ معالجة خطأ التكرار (Unique Violation) في حال توليد رقم موجود مسبقاً
      if (error) {
          if (error.code === '23505') { // Postgres error code for unique violation
             return res.status(400).json({ error: 'حدث تكرار في كود الكورس، يرجى المحاولة مرة أخرى لتوليد كود جديد.' });
          }
          throw error;
      }

      // =========================================================================
      // ✅ 1. منح المدرس صلاحية الوصول للكورس فور إنشائه
      // =========================================================================
      if (type === 'courses' && newItem) {
          // نستخدم auth.userId لجلب معرف المستخدم الخاص بالمدرس
          const userIdToGrant = auth.userId || auth.id; 

          if (userIdToGrant) {
              await supabase.from('user_course_access').upsert({
                  user_id: userIdToGrant,
                  course_id: newItem.id
              }, { onConflict: 'user_id, course_id' });
          }

          // =========================================================================
          // ✅ 2. [إضافة جديدة]: منح الصلاحية للمشرفين المساعدين (فريق العمل)
          // =========================================================================
          try {
            // أ. جلب قائمة المساعدين المرتبطين بهذا المعلم
            const { data: teamMembers } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('teacher_id', auth.teacherId);

            if (teamMembers && teamMembers.length > 0) {
                // ب. تجهيز قائمة الصلاحيات للإضافة
                const teamAccessList = teamMembers.map(member => ({
                    user_id: member.user_id,
                    course_id: newItem.id
                }));

                // ج. إضافة الصلاحيات دفعة واحدة
                await supabase.from('user_course_access').upsert(
                    teamAccessList, 
                    { onConflict: 'user_id, course_id' }
                );
                
                console.log(`✅ Granted access to ${teamMembers.length} team members for course ${newItem.id}`);
            }
          } catch (teamError) {
              console.error("Error granting access to team members:", teamError);
              // لا نوقف العملية لأن الكورس تم إنشاؤه بالفعل، فقط نسجل الخطأ
          }
      }
      // =========================================================================

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) ---
    if (action === 'update') {
      const { id, ...updates } = data;
      
      // هنا يجب إضافة شرط أن العنصر يتبع للمعلم (teacher_id) في حالة الكورسات
      let query = supabase.from(type).update(updates).eq('id', id);
      
      if (type === 'courses') {
        query = query.eq('teacher_id', auth.teacherId);
      }

      const { error } = await query;

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // --- حذف عنصر (Delete) ---
    if (action === 'delete') {
      const { id } = data;
      
      let query = supabase.from(type).delete().eq('id', id);
      
      // حماية الحذف: التأكد من الملكية للكورسات
      if (type === 'courses') {
        query = query.eq('teacher_id', auth.teacherId);
      }

      const { error } = await query;

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

  } catch (err) {
    console.error("Teacher Content API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
