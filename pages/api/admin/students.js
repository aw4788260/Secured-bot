import { supabase } from '../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. الحماية: التأكد أن الطالب Super Admin
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; // تم إرسال الرد في الدالة المساعدة

  // ==========================================================
  // 🟢 التعامل مع طلبات GET (جلب البيانات)
  // ==========================================================
  if (req.method === 'GET') {
    const { page = 1, limit = 30, search, courses_filter, subjects_filter, get_details_for_user } = req.query;

    // A. جلب تفاصيل طالب محدد (الاشتراكات)
    if (get_details_for_user) {
      try {
        // جلب الكورسات المشترك بها
        const { data: userCourses } = await supabase
          .from('student_courses')
          .select('course_id, courses(id, title)')
          .eq('user_id', get_details_for_user);

        // جلب المواد الفردية المشترك بها
        const { data: userSubjects } = await supabase
          .from('student_subjects')
          .select('subject_id, subjects(id, title)')
          .eq('user_id', get_details_for_user);

        return res.status(200).json({
          courses: userCourses || [],
          subjects: userSubjects || []
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // B. جلب قائمة الطلاب (مع الفلترة والبحث)
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // بناء الاستعلام الأساسي
      let query = supabase
        .from('users')
        .select('id, first_name, username, phone, role, is_blocked, device_id, created_at, is_admin', { count: 'exact' })
        .eq('role', 'student') // نجلب الطلاب فقط
        .order('created_at', { ascending: false })
        .range(from, to);

      // تطبيق البحث
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,phone.ilike.%${search}%,username.ilike.%${search}%`);
      }

      // تطبيق فلتر الكورسات (المشتركين في كورسات معينة)
      if (courses_filter) {
        // نحتاج لجلب الـ user_ids من جدول الاشتراكات أولاً
        const courseIds = courses_filter.split(',');
        const { data: courseUsers } = await supabase
          .from('student_courses')
          .select('user_id')
          .in('course_id', courseIds);
        
        const userIds = courseUsers?.map(u => u.user_id) || [];
        // إذا لم يكن هناك مشتركين، نرجع قائمة فارغة (أو نضيف شرط مستحيل)
        if (userIds.length > 0) {
            query = query.in('id', userIds);
        } else {
            // شرط يجعل النتيجة فارغة لأن الفلتر لم يجد أحداً
            query = query.eq('id', 0);
        }
      }

      // تطبيق فلتر المواد (نفس المنطق)
      if (subjects_filter) {
        const subjectIds = subjects_filter.split(',');
        const { data: subjectUsers } = await supabase
          .from('student_subjects')
          .select('user_id')
          .in('subject_id', subjectIds);

        const userIds = subjectUsers?.map(u => u.user_id) || [];
        if (userIds.length > 0) {
           query = query.in('id', userIds);
        } else {
           query = query.eq('id', 0);
        }
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return res.status(200).json({
        students: data,
        total: count
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'فشل جلب الطلاب' });
    }
  }

  // ==========================================================
  // 🟠 التعامل مع طلبات POST (الإجراءات)
  // ==========================================================
  if (req.method === 'POST') {
    const { action, userId, userIds, data, grantList, courseId, subjectId } = req.body;

    try {
      switch (action) {
        // 1. الحظر
        case 'block_user':
          await supabase.from('users').update({ is_blocked: true }).eq('id', userId);
          return res.json({ message: 'تم حظر الطالب بنجاح' });

        case 'unblock_user':
          await supabase.from('users').update({ is_blocked: false }).eq('id', userId);
          return res.json({ message: 'تم فك الحظر بنجاح' });

        // 2. تصفير الجهاز
        case 'reset_device':
          await supabase.from('users').update({ device_id: null }).eq('id', userId);
          return res.json({ message: 'تم تصفير جهاز الطالب' });

        // 3. حذف مستخدم (واحد)
        case 'delete_user':
          // الحذف المتسلسل (Cascading) يعتمد على إعدادات قاعدة البيانات، 
          // لكن للأمان نحذف الارتباطات يدوياً إذا لم تكن مفعلة
          await supabase.from('student_courses').delete().eq('user_id', userId);
          await supabase.from('student_subjects').delete().eq('user_id', userId);
          await supabase.from('users').delete().eq('id', userId);
          return res.json({ message: 'تم حذف الحساب نهائياً' });

        // 4. حذف جماعي
        case 'delete_user_bulk':
          if (!userIds || !userIds.length) return res.status(400).json({ error: 'لم يتم تحديد طلاب' });
          await supabase.from('student_courses').delete().in('user_id', userIds);
          await supabase.from('student_subjects').delete().in('user_id', userIds);
          await supabase.from('users').delete().in('id', userIds);
          return res.json({ message: `تم حذف ${userIds.length} طلاب` });

        // 5. تحديث البيانات (بروفايل)
        case 'update_profile':
          if (!data) return res.status(400).json({ error: 'لا توجد بيانات' });
          const updates = { 
             first_name: data.first_name, 
             phone: data.phone,
             username: data.username 
          };
          if (data.password && data.password.trim() !== '') {
             updates.password = data.password; // يفضل تشفيرها إذا لم يكن النظام يفعل ذلك تلقائياً
          }
          const { error: updateErr } = await supabase.from('users').update(updates).eq('id', userId);
          if (updateErr) throw updateErr;
          return res.json({ message: 'تم تحديث البيانات بنجاح' });

        // 6. منح صلاحيات (Grant Access) - فردي أو جماعي
        case 'grant_access':
          const targetUserIds = userIds || [userId]; // دعم الفردي والجماعي
          const { courses: gCourses, subjects: gSubjects } = grantList;

          // إعداد صفوف الكورسات للإدراج
          const courseInserts = [];
          if (gCourses && gCourses.length > 0) {
            targetUserIds.forEach(uid => {
                gCourses.forEach(cid => {
                    courseInserts.push({ user_id: uid, course_id: cid });
                });
            });
          }

          // إعداد صفوف المواد للإدراج
          const subjectInserts = [];
          if (gSubjects && gSubjects.length > 0) {
            targetUserIds.forEach(uid => {
                gSubjects.forEach(sid => {
                    subjectInserts.push({ user_id: uid, subject_id: sid });
                });
            });
          }

          // تنفيذ الإدراج (Upsert لتجنب الأخطاء عند التكرار)
          if (courseInserts.length > 0) {
              await supabase.from('student_courses').upsert(courseInserts, { onConflict: 'user_id,course_id' });
          }
          if (subjectInserts.length > 0) {
              await supabase.from('student_subjects').upsert(subjectInserts, { onConflict: 'user_id,subject_id' });
          }

          return res.json({ message: 'تم منح الصلاحيات بنجاح' });

        // 7. سحب صلاحية (Revoke)
        case 'revoke_access':
          // سحب كورس
          if (courseId) {
             // إذا كان جماعي (userIds) أو فردي (userId)
             let q = supabase.from('student_courses').delete().eq('course_id', courseId);
             if (userIds && userIds.length) q = q.in('user_id', userIds);
             else if (userId) q = q.eq('user_id', userId);
             await q;
          }
          // سحب مادة
          if (subjectId) {
             let q = supabase.from('student_subjects').delete().eq('subject_id', subjectId);
             if (userIds && userIds.length) q = q.in('user_id', userIds);
             else if (userId) q = q.eq('user_id', userId);
             await q;
          }
          return res.json({ message: 'تم سحب الصلاحية' });

        default:
          return res.status(400).json({ error: 'إجراء غير معروف' });
      }

    } catch (err) {
      console.error(`Error in action ${action}:`, err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الإجراء' });
    }
  }

  // إذا لم يكن GET أو POST
  return res.status(405).json({ error: 'Method not allowed' });
}
