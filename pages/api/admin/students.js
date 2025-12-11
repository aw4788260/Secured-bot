import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import bcrypt from 'bcryptjs';

const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID;

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase.from('users').select('id, is_admin').eq('session_token', sessionToken).single();
  if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Access Denied' });

  const isMainAdmin = String(adminUser.id) === String(MAIN_ADMIN_ID);

  // ---------------------------------------------------------
  // GET (Server-Side Pagination & Filtering)
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    const { 
        page = 1, 
        limit = 30, 
        search, 
        courses_filter, 
        subjects_filter, 
        get_details_for_user 
    } = req.query;

    try {
        if (get_details_for_user) {
            const { data: userCourses } = await supabase.from('user_course_access').select('course_id, courses(title)').eq('user_id', get_details_for_user);
            const { data: userSubjects } = await supabase.from('user_subject_access').select('subject_id, subjects(title, course_id)').eq('user_id', get_details_for_user);
            return res.status(200).json({ courses: userCourses || [], subjects: userSubjects || [] });
        }

        // [تعديل 1] إزالة فلتر .eq('is_admin', false) ليظهر الجميع (طلاب ومشرفين)
        let query = supabase
            .from('users')
            .select(`id, first_name, username, phone, created_at, is_blocked, is_admin, devices(fingerprint)`, { count: 'exact' });

        // 1. تطبيق البحث
        if (search && search.trim() !== '') {
            const term = search.trim();
            let orQuery = `first_name.ilike.%${term}%,username.ilike.%${term}%,phone.ilike.%${term}%`;
            if (/^\d+$/.test(term)) {
                orQuery += `,id.eq.${term}`;
            }
            query = query.or(orQuery);
        }

        // 2. تطبيق الفلترة
        let targetUserIds = new Set();
        let isFiltering = false;

        if (courses_filter && courses_filter.length > 0) {
            isFiltering = true;
            const cIds = courses_filter.split(',');
            const { data: subs } = await supabase.from('user_course_access').select('user_id').in('course_id', cIds);
            subs?.forEach(s => targetUserIds.add(s.user_id));
        }

        if (subjects_filter && subjects_filter.length > 0) {
            isFiltering = true;
            const sIds = subjects_filter.split(',');
            const { data: subSubs } = await supabase.from('user_subject_access').select('user_id').in('subject_id', sIds);
            subSubs?.forEach(s => targetUserIds.add(s.user_id));
            
            const { data: subjectsInfo } = await supabase.from('subjects').select('course_id').in('id', sIds);
            const parentCourseIds = subjectsInfo?.map(s => s.course_id).filter(id => id) || [];
            
            if (parentCourseIds.length > 0) {
                const { data: courseSubs } = await supabase.from('user_course_access').select('user_id').in('course_id', parentCourseIds);
                courseSubs?.forEach(s => targetUserIds.add(s.user_id));
            }
        }

        if (isFiltering) {
            if (targetUserIds.size > 0) {
                query = query.in('id', Array.from(targetUserIds));
            } else {
                return res.status(200).json({ students: [], total: 0, isMainAdmin }); 
            }
        }

        // 3. التقسيم (Pagination)
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        // ترتيب النتائج: المشرفين أولاً ثم الأحدث
        query = query.order('is_admin', { ascending: false }).order('created_at', { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const formattedData = data.map(user => ({ ...user, device_linked: user.devices && user.devices.length > 0 }));
        
        // [تعديل] نرسل حالة isMainAdmin للواجهة للتحكم في الأزرار
        return res.status(200).json({ students: formattedData, total: count, isMainAdmin });

    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ---------------------------------------------------------
  // POST
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    const { action, userIds, userId, newData, grantList } = req.body;
    const targets = userIds || [userId];

    try {
        // [تعديل 2] استبدال 'toggle_block' بـ 'delete_user' مع الحذف المتسلسل
        if (action === 'delete_user') {
            for (const targetId of targets) {
                // أ) التحقق: هل الهدف أدمن؟
                const { data: targetUser } = await supabase.from('users').select('is_admin').eq('id', targetId).single();
                
                if (targetUser && targetUser.is_admin) {
                    // إذا كان أدمن، يجب أن يكون الطالب هو الأدمن الرئيسي
                    if (!isMainAdmin) {
                        return res.status(403).json({ error: `لا يمكنك حذف المشرف (ID: ${targetId}) إلا إذا كنت الأدمن الرئيسي.` });
                    }
                    // لا يمكن حذف الأدمن الرئيسي نفسه
                    if (String(targetId) === String(MAIN_ADMIN_ID)) {
                        return res.status(403).json({ error: 'لا يمكن حذف الحساب الرئيسي.' });
                    }
                }

                // ب) الحذف المتسلسل (تنظيف الجداول المرتبطة أولاً)
                await supabase.from('user_course_access').delete().eq('user_id', targetId);
                await supabase.from('user_subject_access').delete().eq('user_id', targetId);
                await supabase.from('devices').delete().eq('user_id', targetId);
                await supabase.from('subscription_requests').delete().eq('user_id', targetId);
                
                // (حذف المحاولات سيحذف الإجابات تلقائياً إذا كان هناك Cascade في الداتابيز، وإلا أضف حذف الإجابات هنا)
                // يفضل حذف الإجابات أولاً للأمان:
                const { data: attempts } = await supabase.from('user_attempts').select('id').eq('user_id', targetId);
                if (attempts && attempts.length > 0) {
                    const attemptIds = attempts.map(a => a.id);
                    await supabase.from('user_answers').delete().in('attempt_id', attemptIds);
                    await supabase.from('user_attempts').delete().eq('user_id', targetId);
                }

                // ج) أخيراً: حذف المستخدم
                await supabase.from('users').delete().eq('id', targetId);
            }
            return res.status(200).json({ success: true, message: 'تم حذف الحسابات والبيانات المرتبطة نهائياً.' });
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
