import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  // 1. التحقق من صلاحية المستخدم
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
      return res.status(401).json({ success: false, message: 'Unauthorized Access' });
  }

  const userId = req.headers['x-user-id'];

  try {
      // 2. جلب أرقام الكورسات والمواد التي يمتلكها الطالب
      const { data: courses } = await supabase.from('user_course_access').select('course_id').eq('user_id', userId);
      const { data: subjects } = await supabase.from('user_subject_access').select('subject_id').eq('user_id', userId);

      const courseIds = courses ? courses.map(c => c.course_id.toString()) : [];
      const subjectIds = subjects ? subjects.map(s => s.subject_id.toString()) : [];

      // 3. بناء استعلام (Query) ذكي لجلب الإشعارات المناسبة فقط
      // - إشعارات للكل (all)
      // - إشعارات للطالب نفسه (user)
      // - إشعارات لكورساته (course)
      // - إشعارات لمواده (subject)
      
      let orQuery = `target_type.eq.all,and(target_type.eq.user,target_id.eq.${userId})`;
      
      if (courseIds.length > 0) {
          orQuery += `,and(target_type.eq.course,target_id.in.(${courseIds.join(',')}))`;
      }
      if (subjectIds.length > 0) {
          orQuery += `,and(target_type.eq.subject,target_id.in.(${subjectIds.join(',')}))`;
      }

      // 4. تنفيذ الاستعلام وجلب أحدث 50 إشعار
      const { data: notifications, error } = await supabase
          .from('notifications')
          .select('id, title, body, created_at')
          .or(orQuery)
          .order('created_at', { ascending: false })
          .limit(50);

      if (error) throw error;

      return res.status(200).json({ success: true, notifications });

  } catch (err) {
      console.error("Notifications API Error:", err);
      return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
