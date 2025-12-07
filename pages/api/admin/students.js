import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  // 1. التحقق الأمني
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  // ---------------------------------------------------------
  // GET: جلب الطلاب (مع الفلترة الذكية)
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    const { filter_type, filter_id, get_details_for_user } = req.query;

    try {
        // أ) جلب تفاصيل طالب واحد (للملف الشخصي)
        if (get_details_for_user) {
            const { data: userCourses } = await supabase
                .from('user_course_access')
                .select('course_id, courses(title)')
                .eq('user_id', get_details_for_user);
            
            const { data: userSubjects } = await supabase
                .from('user_subject_access')
                .select('subject_id, subjects(title, course_id)')
                .eq('user_id', get_details_for_user);

            return res.status(200).json({ 
                courses: userCourses || [], 
                subjects: userSubjects || [] 
            });
        }

        // ب) جلب قائمة الطلاب
        let query = supabase
            .from('users')
            .select(`id, first_name, username, phone, created_at, is_blocked, devices(fingerprint)`)
            .eq('is_admin', false)
            .order('created_at', { ascending: false });

        // --- منطق الفلترة الذكية ---
        let targetUserIds = new Set();
        let hasFilter = false;

        if (filter_type === 'course' && filter_id) {
            hasFilter = true;
            // جلب المشتركين في الكورس مباشرة
            const { data: subs } = await supabase.from('user_course_access').select('user_id').eq('course_id', filter_id);
            subs?.forEach(s => targetUserIds.add(s.user_id));
        } 
        else if (filter_type === 'subject' && filter_id) {
            hasFilter = true;
            // 1. المشتركين في المادة مباشرة
            const { data: subSubs } = await supabase.from('user_subject_access').select('user_id').eq('subject_id', filter_id);
            subSubs?.forEach(s => targetUserIds.add(s.user_id));

            // 2. المشتركين في الكورس الكامل الذي يحتوي هذه المادة (Parent Course)
            const { data: subjectInfo } = await supabase.from('subjects').select('course_id').eq('id', filter_id).single();
            if (subjectInfo?.course_id) {
                const { data: courseSubs } = await supabase.from('user_course_access').select('user_id').eq('course_id', subjectInfo.course_id);
                courseSubs?.forEach(s => targetUserIds.add(s.user_id));
            }
        }

        // تطبيق الفلتر إن وجد
        if (hasFilter) {
            if (targetUserIds.size > 0) {
                // تحويل الـ Set لمصفوفة
                query = query.in('id', Array.from(targetUserIds));
            } else {
                return res.status(200).json([]); // لا يوجد نتائج
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        const formattedData = data.map(user => ({
            ...user,
            device_linked: user.devices && user.devices.length > 0
        }));

        return res.status(200).json(formattedData);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
  }

  // ---------------------------------------------------------
  // POST: تنفيذ الإجراءات
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    const { action, userIds, userId, newData, courseId, subjectId } = req.body;
    const targets = userIds || [userId]; // دعم الفردي والجماعي

    try {
        // 1. تبديل الحظر
        if (action === 'toggle_block') {
            const { is_blocked } = newData;
            await supabase.from('users').update({ is_blocked }).in('id', targets);
            return res.status(200).json({ success: true, message: 'تم تحديث حالة الحظر.' });
        }

        // 2. حذف البصمة
        if (action === 'reset_device') {
            await supabase.from('devices').delete().in('user_id', targets);
            return res.status(200).json({ success: true, message: 'تم تصفير الأجهزة.' });
        }

        // 3. تغيير كلمة المرور (مع التشفير ✅)
        if (action === 'change_password') {
            if (!newData.password || newData.password.length < 6) return res.status(400).json({ error: 'كلمة المرور قصيرة' });
            
            // التشفير هنا
            const hashedPassword = await bcrypt.hash(newData.password, 10);
            await supabase.from('users').update({ password: hashedPassword }).eq('id', userId);
            return res.status(200).json({ success: true, message: 'تم تغيير وتشفير كلمة المرور.' });
        }

        // 4. تغيير اسم المستخدم
        if (action === 'change_username') {
            const { error } = await supabase.from('users').update({ username: newData.username }).eq('id', userId);
            if (error) throw error;
            return res.status(200).json({ success: true, message: 'تم تغيير اسم المستخدم.' });
        }

        // 5. منح صلاحية (للجميع)
        if (action === 'grant_access') {
            let inserts = [];
            if (courseId) {
                inserts = targets.map(uid => ({ user_id: uid, course_id: courseId }));
                await supabase.from('user_course_access').upsert(inserts, { onConflict: 'user_id, course_id' });
            } else if (subjectId) {
                inserts = targets.map(uid => ({ user_id: uid, subject_id: subjectId }));
                await supabase.from('user_subject_access').upsert(inserts, { onConflict: 'user_id, subject_id' });
            }
            return res.status(200).json({ success: true, message: 'تم منح الصلاحيات بنجاح.' });
        }

        // 6. سحب صلاحية (للجميع)
        if (action === 'revoke_access') {
            if (courseId) {
                await supabase.from('user_course_access').delete().in('user_id', targets).eq('course_id', courseId);
            } else if (subjectId) {
                await supabase.from('user_subject_access').delete().in('user_id', targets).eq('subject_id', subjectId);
            }
            return res.status(200).json({ success: true, message: 'تم سحب الصلاحيات.' });
        }

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
  }
};
