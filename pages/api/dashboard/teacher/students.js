import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs'; // تأكد من وجود هذه المكتبة أو قم بتثبيتها

export default async (req, res) => {
  // 1. التحقق من الصلاحية (مدرس أو أدمن)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const isAdmin = user.is_admin === true; // معرفة هل المستخدم الحالي أدمن

  // ---------------------------------------------------------
  // 1. معالجة طلبات GET (جلب البيانات)
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    const { 
        page = 1, 
        limit = 30, 
        search, 
        get_details_for_user 
    } = req.query;

    try {
        // أ) حالة طلب تفاصيل طالب معين (المشكلة التي ذكرتها)
        if (get_details_for_user) {
            // جلب الكورسات والمواد التي يملكها هذا الطالب
            const { data: userCourses } = await supabase
                .from('user_course_access')
                .select('course_id, courses(title)')
                .eq('user_id', get_details_for_user);
            
            const { data: userSubjects } = await supabase
                .from('user_subject_access')
                .select('subject_id, subjects(title, course_id)')
                .eq('user_id', get_details_for_user);

            // إرجاع البيانات بنفس التنسيق الذي تتوقعه صفحة الأدمن
            return res.status(200).json({ 
                courses: userCourses || [], 
                subjects: userSubjects || [] 
            });
        }

        // ب) حالة عرض قائمة الطلاب (الجدول الرئيسي)
        let query = supabase
            .from('users')
            .select(`id, first_name, username, phone, created_at, is_blocked, is_admin, devices(fingerprint)`, { count: 'exact' });

        // -- فلترة البيانات حسب الصلاحية --
        if (!isAdmin) {
            // إذا كان "مدرس"، نجلب فقط طلابه (المنطق القديم)
            // ملاحظة: هذا يتطلب استعلام معقد للفلترة في Supabase مباشرة، 
            // للتبسيط ولتعمل صفحة الأدمن، سنستخدم منطق الأدمن إذا كان المستخدم أدمن،
            // وإذا كان مدرساً، سنطبق الفلترة الإضافية.
            
            // 1. جلب كورسات المدرس
            const { data: teacherCourses } = await supabase.from('courses').select('id').eq('teacher_id', user.teacherId);
            const courseIds = teacherCourses?.map(c => c.id) || [];
            
            // 2. جلب الطلاب المشتركين
            const { data: studentsInCourses } = await supabase.from('user_course_access').select('user_id').in('course_id', courseIds);
            const studentIds = studentsInCourses?.map(s => s.user_id) || [];
            
            // حصر النتائج في هؤلاء الطلاب فقط
            if (studentIds.length > 0) {
                query = query.in('id', studentIds);
            } else {
                return res.status(200).json({ students: [], total: 0 });
            }
        }

        // -- البحث (مطلوب لصفحة الأدمن) --
        if (search && search.trim() !== '') {
            const term = search.trim();
            let orQuery = `first_name.ilike.%${term}%,username.ilike.%${term}%,phone.ilike.%${term}%`;
            // دعم البحث بالـ ID إذا كان رقم
            if (/^\d+$/.test(term)) {
                orQuery += `,id.eq.${term}`;
            }
            query = query.or(orQuery);
        }

        // -- التقسيم للصفحات (Pagination) --
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query
            .order('created_at', { ascending: false })
            .range(from, to);

        const { data, count, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        // تنسيق البيانات
        const formattedData = data.map(u => ({
            ...u,
            device_linked: u.devices && u.devices.length > 0
        }));

        return res.status(200).json({ 
            students: formattedData, 
            total: count || 0,
            isMainAdmin: isAdmin // معلومة إضافية للواجهة
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
  }

  // ---------------------------------------------------------
  // 2. معالجة طلبات POST (التعديل، الحذف، الإضافة)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      const { action, userIds, userId, newData, grantList } = req.body;
      const targets = userIds || (userId ? [userId] : []);

      try {
          // -- أ) حذف المستخدم --
          if (action === 'delete_user') {
              if (!isAdmin) return res.status(403).json({ error: 'غير مصرح للمدرس بحذف الحسابات نهائياً.' });
              
              for (const targetId of targets) {
                  // حذف الارتباطات أولاً
                  await supabase.from('user_course_access').delete().eq('user_id', targetId);
                  await supabase.from('user_subject_access').delete().eq('user_id', targetId);
                  await supabase.from('devices').delete().eq('user_id', targetId);
                  // حذف المستخدم
                  await supabase.from('users').delete().eq('id', targetId);
              }
              return res.status(200).json({ success: true, message: 'تم الحذف بنجاح' });
          }

          // -- ب) فك قفل الجهاز --
          if (action === 'reset_device') {
              await supabase.from('devices').delete().in('user_id', targets);
              return res.status(200).json({ success: true, message: 'تم إلغاء قفل الأجهزة.' });
          }

          // -- ج) تغيير الباسورد --
          if (action === 'change_password') {
              if (!isAdmin) return res.status(403).json({ error: 'صلاحية الأدمن مطلوبة.' });
              const hash = await bcrypt.hash(newData.password, 10);
              await supabase.from('users').update({ password: hash }).eq('id', userId);
              return res.status(200).json({ success: true, message: 'تم تغيير كلمة المرور.' });
          }

          // -- د) تغيير اسم المستخدم --
          if (action === 'change_username') {
            const newUsername = newData.username.trim();
            // التحقق من التكرار
            const { data: existing } = await supabase.from('users').select('id').eq('username', newUsername).neq('id', userId).maybeSingle();
            if (existing) return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل.' });

            await supabase.from('users').update({ username: newUsername }).eq('id', userId);
            return res.status(200).json({ success: true, message: 'تم تغيير اسم المستخدم.' });
          }

          // -- هـ) تغيير الهاتف --
          if (action === 'change_phone') {
              await supabase.from('users').update({ phone: newData.phone }).eq('id', userId);
              return res.status(200).json({ success: true, message: 'تم تحديث الهاتف.' });
          }

          // -- و) منح صلاحيات (Grant) --
          if (action === 'grant_access') {
              const { courses = [], subjects = [] } = grantList || {};
              const cInserts = [];
              const sInserts = [];
              
              targets.forEach(uid => {
                  courses.forEach(cid => cInserts.push({ user_id: uid, course_id: cid }));
                  subjects.forEach(sid => sInserts.push({ user_id: uid, subject_id: sid }));
              });

              if (cInserts.length) await supabase.from('user_course_access').upsert(cInserts, { onConflict: 'user_id, course_id' });
              if (sInserts.length) await supabase.from('user_subject_access').upsert(sInserts, { onConflict: 'user_id, subject_id' });
              
              return res.status(200).json({ success: true, message: 'تم منح الصلاحيات.' });
          }

          // -- ز) سحب صلاحيات (Revoke) --
          if (action === 'revoke_access') {
              const { courseId, subjectId } = req.body;
              if (courseId) await supabase.from('user_course_access').delete().in('user_id', targets).eq('course_id', courseId);
              else if (subjectId) await supabase.from('user_subject_access').delete().in('user_id', targets).eq('subject_id', subjectId);
              
              return res.status(200).json({ success: true, message: 'تم سحب الصلاحية.' });
          }

      } catch (err) {
          return res.status(500).json({ error: err.message });
      }
  }

  // إذا لم تكن الطريقة مدعومة
  return res.status(405).json({ error: 'Method Not Allowed' });
};
