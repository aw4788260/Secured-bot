import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية
  // auth: { userId (المستخدم الفعلي), teacherId (بروفايل المعلم), role, ... }
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

        // ✅ توليد كود رقمي عشوائي مكون من 6 أرقام للكورس
        if (!insertData.code) {
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

      // ✅ معالجة خطأ التكرار (Unique Violation)
      if (error) {
          if (error.code === '23505') { 
             return res.status(400).json({ error: 'حدث تكرار في كود الكورس، يرجى المحاولة مرة أخرى.' });
          }
          throw error;
      }

      // =========================================================================
      // ✅ [تعديل شامل]: منح الصلاحيات (للمنشئ + المعلم المالك + جميع المشرفين)
      // =========================================================================
      if (type === 'courses' && newItem) {
          try {
            const accessList = [];
            
            // 1️⃣ إضافة المنشئ الحالي (سواء كان المعلم أو المشرف)
            // نأخذ الـ ID من نتيجة التحقق (verifyTeacher)
            const currentUserId = auth.userId || auth.id;
            if (currentUserId) {
                accessList.push({ user_id: currentUserId, course_id: newItem.id });
            }

            // 2️⃣ إضافة المعلم الرئيسي (المالك) لضمان عدم فقدانه الصلاحية إذا أنشأ الكورس مشرف
            // نستعلم عن user_id الخاص بالمعلم من جدول teachers باستخدام teacherId
            const { data: teacherData } = await supabase
                .from('teachers')
                .select('user_id')
                .eq('id', auth.teacherId)
                .single();

            // إذا وجدنا المعلم وكان مختلفاً عن الشخص الحالي (المنشئ)، نضيفه
            if (teacherData && teacherData.user_id && teacherData.user_id !== currentUserId) {
                accessList.push({ user_id: teacherData.user_id, course_id: newItem.id });
            }

            // 3️⃣ إضافة باقي فريق العمل (المشرفين المساعدين)
            const { data: teamMembers } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('teacher_id', auth.teacherId);

            if (teamMembers && teamMembers.length > 0) {
                teamMembers.forEach(member => {
                    // نتأكد من عدم تكرار الإضافة (إذا كان المشرف هو المنشئ مثلاً)
                    const isAlreadyAdded = accessList.some(item => item.user_id === member.user_id);
                    if (!isAlreadyAdded) {
                        accessList.push({ user_id: member.user_id, course_id: newItem.id });
                    }
                });
            }

            // 4️⃣ تنفيذ الإضافة الجماعية للصلاحيات (Upsert)
            if (accessList.length > 0) {
                await supabase.from('user_course_access').upsert(
                    accessList, 
                    { onConflict: 'user_id, course_id' }
                );
                console.log(`✅ Permissions granted to ${accessList.length} users for course ${newItem.id}`);
            }

          } catch (permError) {
              console.error("Error granting permissions:", permError);
              // لا نوقف العملية لأن الكورس تم إنشاؤه بنجاح، فقط نسجل الخطأ
          }
      }
      // =========================================================================

      return res.status(200).json({ success: true, item: newItem });
    }

    // --- تعديل عنصر (Update) ---
    if (action === 'update') {
      const { id, ...updates } = data;
      
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
