import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من صلاحية السوبر أدمن
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // -- تحضير البيانات: جلب كل المحتوى في النظام (لحساب القوائم المتاحة للمنح) --
  // السوبر أدمن يرى جميع الكورسات والمواد
  const { data: allCourses } = await supabase
    .from('courses')
    .select('id, title');
    
  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('id, title, course_id');

  // ==========================================================
  // 🟢 التعامل مع طلبات GET (جلب البيانات)
  // ==========================================================
  if (req.method === 'GET') {
    const { page = 1, limit = 30, search, courses_filter, subjects_filter, get_details_for_user } = req.query;

    // A. جلب تفاصيل طالب محدد (الاشتراكات + ما يمكن إضافته)
    if (get_details_for_user) {
      try {
        // 1. جلب الاشتراكات الحالية
        const { data: userCourses } = await supabase
          .from('user_course_access')
          .select('course_id, courses(id, title)')
          .eq('user_id', get_details_for_user);

        const { data: userSubjects } = await supabase
          .from('user_subject_access')
          .select('subject_id, subjects(id, title, course_id)')
          .eq('user_id', get_details_for_user);

        // استخراج IDs التي يملكها الطالب حالياً
        const ownedCourseIds = userCourses?.map(uc => uc.course_id) || [];
        const ownedSubjectIds = userSubjects?.map(us => us.subject_id) || [];

        // 2. حساب الكورسات المتاحة للإضافة (الكل - المملوك)
        const availableCourses = allCourses?.filter(c => !ownedCourseIds.includes(c.id)) || [];

        // 3. حساب المواد المتاحة للإضافة (الكل - المملوك - مواد الكورسات المملوكة)
        const availableSubjects = allSubjects?.filter(s => {
            const isOwned = ownedSubjectIds.includes(s.id);
            const isParentCourseOwned = ownedCourseIds.includes(s.course_id);
            return !isOwned && !isParentCourseOwned;
        }) || [];

        return res.status(200).json({
          courses: userCourses || [],
          subjects: userSubjects || [],
          available_courses: availableCourses,
          available_subjects: availableSubjects
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
      // ملاحظة: جدول devices مرتبط بـ user_id، لذا نستخدم devices(fingerprint)
      let query = supabase
        .from('users')
        .select('id, first_name, username, phone, role, is_blocked, created_at, is_admin, devices(fingerprint)', { count: 'exact' })
        .eq('role', 'student') // حسب السكيما role text default 'student'
        .order('created_at', { ascending: false })
        .range(from, to);

      // تطبيق البحث
      if (search) {
        const term = search.trim();
        let orQuery = `first_name.ilike.%${term}%,phone.ilike.%${term}%,username.ilike.%${term}%`;
        // إذا كان البحث رقمياً قد يكون ID
        if (/^\d+$/.test(term)) orQuery += `,id.eq.${term}`;
        query = query.or(orQuery);
      }

      // تطبيق فلتر الكورسات
      if (courses_filter) {
        const courseIds = courses_filter.split(',');
        const { data: courseUsers } = await supabase
          .from('user_course_access')
          .select('user_id')
          .in('course_id', courseIds);
        
        const userIds = courseUsers?.map(u => u.user_id) || [];
        
        if (userIds.length > 0) {
            query = query.in('id', userIds);
        } else {
            query = query.eq('id', 0); // لا نتائج
        }
      }

      // تطبيق فلتر المواد
      if (subjects_filter) {
        const subjectIds = subjects_filter.split(',');
        const { data: subjectUsers } = await supabase
          .from('user_subject_access')
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

      // تنسيق البيانات لتوضيح هل يوجد جهاز مرتبط
      const formattedData = data.map(user => ({
          ...user,
          device_linked: user.devices && user.devices.length > 0
      }));

      return res.status(200).json({
        students: formattedData,
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
    const targetIds = userIds || (userId ? [userId] : []);

    try {
      switch (action) {
        // 1. الحظر
        case 'block_user':
          await supabase.from('users').update({ is_blocked: true }).in('id', targetIds);
          return res.json({ message: 'تم حظر الطالب/الطلاب بنجاح' });

        case 'unblock_user':
          await supabase.from('users').update({ is_blocked: false }).in('id', targetIds);
          return res.json({ message: 'تم فك الحظر بنجاح' });

        // 2. تصفير الجهاز (تصحيح حسب السكيما)
        case 'reset_device':
          // ✅ السكيما: جدول devices منفصل، لذا نحذف السجلات المرتبطة بالمستخدم
          const { error: resetErr } = await supabase
             .from('devices')
             .delete()
             .in('user_id', targetIds);
          
          if (resetErr) throw resetErr;
          return res.json({ message: 'تم تصفير الأجهزة المرتبطة' });

        // 3. حذف مستخدم
        case 'delete_user':
        case 'delete_user_bulk':
          if (!targetIds.length) return res.status(400).json({ error: 'لم يتم تحديد طلاب' });
          
          // على الرغم من وجود ON DELETE CASCADE، الحذف الصريح آمن
          await supabase.from('user_course_access').delete().in('user_id', targetIds);
          await supabase.from('user_subject_access').delete().in('user_id', targetIds);
          await supabase.from('devices').delete().in('user_id', targetIds); // حذف الأجهزة
          
          const { error: delErr } = await supabase.from('users').delete().in('id', targetIds);
          if (delErr) throw delErr;

          return res.json({ message: `تم حذف ${targetIds.length} حسابات نهائياً` });

        // 4. تحديث البيانات
        case 'update_profile':
          if (!data) return res.status(400).json({ error: 'لا توجد بيانات' });
          const updates = { 
             first_name: data.first_name, 
             phone: data.phone,
             username: data.username 
          };
          // تشفير الباسورد أو تحديثه
          if (data.password && data.password.trim() !== '') {
             updates.password = data.password; 
          }
          const { error: updateErr } = await supabase.from('users').update(updates).eq('id', userId);
          if (updateErr) throw updateErr;
          return res.json({ message: 'تم تحديث البيانات بنجاح' });

        // 5. منح صلاحيات (Grant Access)
        case 'grant_access':
          const { courses: gCourses, subjects: gSubjects } = grantList || {};

          const courseInserts = [];
          if (gCourses && gCourses.length > 0) {
            targetIds.forEach(uid => {
                gCourses.forEach(cid => {
                    courseInserts.push({ user_id: uid, course_id: cid });
                });
            });
          }

          const subjectInserts = [];
          if (gSubjects && gSubjects.length > 0) {
            targetIds.forEach(uid => {
                gSubjects.forEach(sid => {
                    subjectInserts.push({ user_id: uid, subject_id: sid });
                });
            });
          }

          if (courseInserts.length > 0) {
              await supabase.from('user_course_access').upsert(courseInserts, { onConflict: 'user_id,course_id' });
          }
          if (subjectInserts.length > 0) {
              await supabase.from('user_subject_access').upsert(subjectInserts, { onConflict: 'user_id,subject_id' });
          }

          return res.json({ message: 'تم منح الصلاحيات بنجاح' });

        // 6. سحب صلاحية (Revoke)
        case 'revoke_access':
          if (courseId) {
             await supabase.from('user_course_access').delete().in('user_id', targetIds).eq('course_id', courseId);
          }
          if (subjectId) {
             await supabase.from('user_subject_access').delete().in('user_id', targetIds).eq('subject_id', subjectId);
          }
          return res.json({ message: 'تم سحب الصلاحية' });

        default:
          return res.status(400).json({ error: 'إجراء غير معروف' });
      }

    } catch (err) {
      console.error(`Error in action ${action}:`, err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الإجراء: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
