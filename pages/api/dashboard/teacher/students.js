import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const teacherId = user.teacherId;

    // ---------------------------------------------------------
    // أ: جلب الكورسات والمواد الخاصة بالمعلم
    // ---------------------------------------------------------
    
    // 1. جلب الكورسات
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', teacherId);

    if (coursesError) throw coursesError;

    const courseIds = courses.map(c => c.id);

    if (courseIds.length === 0) {
        return res.status(200).json({ students: [] });
    }

    // 2. جلب المواد (Subjects) التابعة لهذه الكورسات
    // لأن الطالب قد يشتري مادة فردية داخل الكورس
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, title, course_id')
      .in('course_id', courseIds);

    if (subjectsError) throw subjectsError;

    const subjectIds = subjects.map(s => s.id);

    // ---------------------------------------------------------
    // ب: جلب اشتراكات الطلاب (كورسات + مواد)
    // ---------------------------------------------------------

    // استخدام Promise.all لتنفيذ الاستعلامين في نفس الوقت لتحسين الأداء
    const [courseAccessResult, subjectAccessResult] = await Promise.all([
        // جلب من اشترى كورسات كاملة
        supabase
            .from('user_course_access')
            .select(`
                user_id, course_id,
                users:user_id (id, first_name, username, phone, created_at)
            `)
            .in('course_id', courseIds),

        // جلب من اشترى مواد فردية
        supabase
            .from('user_subject_access')
            .select(`
                user_id, subject_id,
                users:user_id (id, first_name, username, phone, created_at)
            `)
            .in('subject_id', subjectIds)
    ]);

    if (courseAccessResult.error) throw courseAccessResult.error;
    if (subjectAccessResult.error) throw subjectAccessResult.error;

    // ---------------------------------------------------------
    // ج: دمج البيانات وتنسيقها
    // ---------------------------------------------------------
    const studentsMap = {};

    // دالة مساعدة لإضافة الطالب أو تحديث بياناته
    const addStudentToMap = (userData, itemName, type) => {
        if (!userData) return;
        const studentId = userData.id;

        // تجهيز اسم العنصر (مع توضيح نوعه: كورس أم مادة)
        const formattedItemName = type === 'course' 
            ? `كورس: ${itemName}` 
            : `مادة: ${itemName}`;

        if (!studentsMap[studentId]) {
            // طالب جديد في القائمة
            studentsMap[studentId] = {
                ...userData,
                enrolled_courses: [formattedItemName], // للاحتفاظ بالتوافق مع الواجهة
                raw_enrollments: [{ type, title: itemName }] // بيانات خام مفصلة (اختياري)
            };
        } else {
            // طالب موجود، نضيف الاشتراك الجديد للقائمة
            // نتأكد من عدم التكرار
            if (!studentsMap[studentId].enrolled_courses.includes(formattedItemName)) {
                studentsMap[studentId].enrolled_courses.push(formattedItemName);
                studentsMap[studentId].raw_enrollments.push({ type, title: itemName });
            }
        }
    };

    // 1. معالجة اشتراكات الكورسات
    courseAccessResult.data.forEach(item => {
        const courseTitle = courses.find(c => c.id === item.course_id)?.title || 'Unknown Course';
        addStudentToMap(item.users, courseTitle, 'course');
    });

    // 2. معالجة اشتراكات المواد
    subjectAccessResult.data.forEach(item => {
        const subjectTitle = subjects.find(s => s.id === item.subject_id)?.title || 'Unknown Subject';
        addStudentToMap(item.users, subjectTitle, 'subject');
    });

    const formattedStudents = Object.values(studentsMap);

    return res.status(200).json({ students: formattedStudents });

  } catch (err) {
    console.error("Students API Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
