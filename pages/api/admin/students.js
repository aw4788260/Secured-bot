import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  // ---------------------------------------------------------
  // GET
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    const { courses_filter, subjects_filter, get_details_for_user } = req.query;

    try {
        if (get_details_for_user) {
            const { data: userCourses } = await supabase.from('user_course_access').select('course_id, courses(title)').eq('user_id', get_details_for_user);
            const { data: userSubjects } = await supabase.from('user_subject_access').select('subject_id, subjects(title, course_id)').eq('user_id', get_details_for_user);
            return res.status(200).json({ courses: userCourses || [], subjects: userSubjects || [] });
        }

        let query = supabase.from('users').select(`id, first_name, username, phone, created_at, is_blocked, devices(fingerprint)`).eq('is_admin', false).order('created_at', { ascending: false });

        // --- منطق الفلترة المتعددة ---
        let targetUserIds = new Set();
        let isFiltering = false;

        // 1. فلترة الكورسات (قائمة IDs)
        if (courses_filter && courses_filter.length > 0) {
            isFiltering = true;
            const cIds = courses_filter.split(',');
            const { data: subs } = await supabase.from('user_course_access').select('user_id').in('course_id', cIds);
            subs?.forEach(s => targetUserIds.add(s.user_id));
        }

        // 2. فلترة المواد (قائمة IDs)
        if (subjects_filter && subjects_filter.length > 0) {
            isFiltering = true;
            const sIds = subjects_filter.split(',');
            
            // أ) المشتركين في المواد مباشرة
            const { data: subSubs } = await supabase.from('user_subject_access').select('user_id').in('subject_id', sIds);
            subSubs?.forEach(s => targetUserIds.add(s.user_id));

            // ب) المشتركين في الكورس الكامل الذي يحتوي هذه المواد
            // نجلب الـ course_id لهذه المواد
            const { data: subjectsInfo } = await supabase.from('subjects').select('course_id').in('id', sIds);
            const parentCourseIds = subjectsInfo?.map(s => s.course_id).filter(id => id) || [];
            
            if (parentCourseIds.length > 0) {
                const { data: courseSubs } = await supabase.from('user_course_access').select('user_id').in('course_id', parentCourseIds);
                courseSubs?.forEach(s => targetUserIds.add(s.user_id));
            }
        }

        // تطبيق الفلتر
        if (isFiltering) {
            if (targetUserIds.size > 0) {
                query = query.in('id', Array.from(targetUserIds));
            } else {
                return res.status(200).json([]); // لا يوجد نتائج
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        const formattedData = data.map(user => ({ ...user, device_linked: user.devices && user.devices.length > 0 }));
        return res.status(200).json(formattedData);

    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ---------------------------------------------------------
  // POST (نفس المنطق السابق بدون تغيير)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    const { action, userIds, userId, newData, grantList } = req.body;
    const targets = userIds || [userId];

    try {
        if (action === 'toggle_block') {
            await supabase.from('users').update({ is_blocked: newData.is_blocked }).in('id', targets);
            return res.status(200).json({ success: true, message: 'تم التحديث.' });
        }
        if (action === 'reset_device') {
            await supabase.from('devices').delete().in('user_id', targets);
            return res.status(200).json({ success: true, message: 'تم إلغاء قفل الأجهزة.' });
        }
        if (action === 'change_password') {
            const hash = await bcrypt.hash(newData.password, 10);
            await supabase.from('users').update({ password: hash }).eq('id', userId);
            return res.status(200).json({ success: true, message: 'تم تغيير كلمة المرور.' });
        }
        if (action === 'change_username') {
            await supabase.from('users').update({ username: newData.username }).eq('id', userId);
            return res.status(200).json({ success: true, message: 'تم تغيير اسم المستخدم.' });
        }
        if (action === 'change_phone') {
            await supabase.from('users').update({ phone: newData.phone }).eq('id', userId);
            return res.status(200).json({ success: true, message: 'تم تحديث رقم الهاتف.' });
        }
        if (action === 'grant_access') {
            const { courses = [], subjects = [] } = grantList || {};
            const courseInserts = [];
            const subjectInserts = [];
            targets.forEach(uid => {
                courses.forEach(cid => courseInserts.push({ user_id: uid, course_id: cid }));
                subjects.forEach(sid => subjectInserts.push({ user_id: uid, subject_id: sid }));
            });
            if (courseInserts.length > 0) await supabase.from('user_course_access').upsert(courseInserts, { onConflict: 'user_id, course_id' });
            if (subjectInserts.length > 0) await supabase.from('user_subject_access').upsert(subjectInserts, { onConflict: 'user_id, subject_id' });
            return res.status(200).json({ success: true, message: 'تم منح الصلاحيات.' });
        }
        if (action === 'revoke_access') {
            const { courseId, subjectId } = req.body;
            if (courseId) await supabase.from('user_course_access').delete().in('user_id', targets).eq('course_id', courseId);
            else if (subjectId) await supabase.from('user_subject_access').delete().in('user_id', targets).eq('subject_id', subjectId);
            return res.status(200).json({ success: true, message: 'تم سحب الصلاحية.' });
        }
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
};
