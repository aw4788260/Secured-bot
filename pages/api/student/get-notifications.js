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
      // 2. جلب أرقام الكورسات التي يمتلكها الطالب
      const { data: userCourses } = await supabase
          .from('user_course_access')
          .select('course_id')
          .eq('user_id', userId);

      const courseIds = userCourses ? userCourses.map(c => c.course_id) : [];

      // 3. جلب أرقام المواد (Subjects) "الموروثة" من الكورسات التي يملكها الطالب
      let inheritedSubjectIds = [];
      if (courseIds.length > 0) {
          const { data: subjectsFromCourses } = await supabase
              .from('subjects')
              .select('id')
              .in('course_id', courseIds);
          
          if (subjectsFromCourses) {
              inheritedSubjectIds = subjectsFromCourses.map(s => s.id.toString());
          }
      }

      // 4. جلب أرقام المواد التي يمتلكها الطالب بشكل منفرد (شراء مادة مخصصة)
      const { data: directSubjects } = await supabase
          .from('user_subject_access')
          .select('subject_id')
          .eq('user_id', userId);

      const directSubjectIds = directSubjects ? directSubjects.map(s => s.subject_id.toString()) : [];

      // 5. دمج جميع أرقام المواد في قائمة واحدة فريدة (بدون تكرار)
      const allAccessibleSubjectIds = Array.from(new Set([...inheritedSubjectIds, ...directSubjectIds]));
      
      // تحويل IDs الكورسات لنصوص للمقارنة في الاستعلام
      const courseIdsStrings = courseIds.map(id => id.toString());

      // 6. بناء استعلام (Query) ذكي لجلب الإشعارات
      // - النوع 'all': للجميع
      // - النوع 'user': لهذا الطالب تحديداً
      // - النوع 'course': لكورس يملكه
      // - النوع 'subject': لمادة يملكها (أو مادة داخل كورس يملكه)
      
      let orQuery = `target_type.eq.all,and(target_type.eq.user,target_id.eq.${userId})`;
      
      if (courseIdsStrings.length > 0) {
          orQuery += `,and(target_type.eq.course,target_id.in.(${courseIdsStrings.join(',')}))`;
      }
      
      if (allAccessibleSubjectIds.length > 0) {
          orQuery += `,and(target_type.eq.subject,target_id.in.(${allAccessibleSubjectIds.join(',')}))`;
      }

      // 7. تنفيذ الاستعلام وجلب أحدث 50 إشعار
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
