import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  // =================================================================
  // GET: البحث عن طلاب أو عرض الفريق الحالي
  // =================================================================
  if (req.method === 'GET') {
    const { mode, query } = req.query;

    try {
      // 1. عرض المشرفين الحاليين التابعين لهذا المعلم
      if (mode === 'list') {
        const { data: team, error } = await supabase
          .from('users')
          .select('id, first_name, username, phone, created_at')
          .eq('role', 'moderator')
          .eq('teacher_profile_id', teacherId); // المشرفون التابعون لهذا المعلم فقط

        if (error) throw error;
        return res.status(200).json(team);
      }

      // 2. البحث عن طلاب لترقيتهم (بحث عام في كل الطلاب)
      if (mode === 'search') {
        if (!query || query.length < 3) return res.status(200).json([]);

        const { data: students, error } = await supabase
          .from('users')
          .select('id, first_name, username, phone')
          .eq('role', 'student') // نبحث في الطلاب فقط
          .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(10);

        if (error) throw error;
        return res.status(200).json(students);
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // =================================================================
  // POST: ترقية طالب أو حذف مشرف
  // =================================================================
  if (req.method === 'POST') {
    const { action, userId } = req.body;

    try {
      // 🅰️ ترقية طالب إلى مشرف + منح صلاحيات الكورسات
      if (action === 'promote') {
        // 1. تحديث دور المستخدم وربطه بالمعلم
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            role: 'moderator', 
            teacher_profile_id: teacherId 
          })
          .eq('id', userId);

        if (updateError) throw updateError;

        // 2. جلب جميع كورسات المعلم
        const { data: myCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('teacher_id', teacherId);

        // 3. منح الصلاحيات تلقائياً لكل الكورسات
        if (myCourses && myCourses.length > 0) {
          const accessRows = myCourses.map(c => ({
            user_id: userId,
            course_id: c.id
          }));

          // استخدام upsert لتجنب الأخطاء إذا كان لديه صلاحية مسبقة
          await supabase.from('user_course_access').upsert(accessRows, { onConflict: 'user_id, course_id' });
        }

        return res.status(200).json({ success: true, message: 'Student promoted and access granted' });
      }

      // 🅱️ سحب الإشراف (إعادته كطالب)
      if (action === 'demote') {
        // التحقق أولاً أن هذا المشرف يتبع هذا المعلم (لمنع حذف مشرفي معلمين آخرين)
        const { data: userCheck } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .eq('teacher_profile_id', teacherId)
            .single();
        
        if (!userCheck) return res.status(403).json({ error: 'Unauthorized to modify this user' });

        // إعادة الدور لطالب وفك الارتباط
        await supabase
          .from('users')
          .update({ 
            role: 'student', 
            teacher_profile_id: null 
          })
          .eq('id', userId);

        return res.status(200).json({ success: true, message: 'Moderator removed' });
      }

    } catch (err) {
      console.error("Team API Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
};
