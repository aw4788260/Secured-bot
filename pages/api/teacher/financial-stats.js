import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من أن المستخدم مدرس
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  try {
    // ---------------------------------------------------------
    // 2. جلب الكورسات والمواد الخاصة بالمدرس (مع حماية ضد null)
    // ---------------------------------------------------------
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', teacherId);
    
    if (coursesError) throw coursesError;
    // ✅ التصحيح: ضمان أنها مصفوفة
    const courses = coursesData || []; 

    const { data: subjectsData, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('teacher_id', teacherId);

    if (subjectsError) throw subjectsError;
    // ✅ التصحيح: ضمان أنها مصفوفة
    const subjects = subjectsData || [];

    const courseIds = courses.map(c => c.id);
    const subjectIds = subjects.map(s => s.id);

    // ---------------------------------------------------------
    // 3. جلب صلاحيات الوصول (مع التحقق من وجود كورسات أصلاً)
    // ---------------------------------------------------------
    
    let courseAccess = [];
    if (courseIds.length > 0) {
      const { data: caData, error: caError } = await supabase
        .from('user_course_access')
        .select('course_id, user_id')
        .in('course_id', courseIds);
      
      if (caError) throw caError;
      courseAccess = caData || [];
    }

    let subjectAccess = [];
    if (subjectIds.length > 0) {
      const { data: saData, error: saError } = await supabase
        .from('user_subject_access')
        .select('subject_id, user_id')
        .in('subject_id', subjectIds);
        
      if (saError) throw saError;
      subjectAccess = saData || [];
    }

    // ---------------------------------------------------------
    // 4. معالجة البيانات للإحصائيات التفصيلية
    // ---------------------------------------------------------

    const coursesStats = courses.map(course => {
      const count = courseAccess.filter(a => a.course_id === course.id).length;
      return { title: course.title, count };
    });

    const subjectsStats = subjects.map(subject => {
      const count = subjectAccess.filter(a => a.subject_id === subject.id).length;
      return { title: subject.name, count };
    });

    // ---------------------------------------------------------
    // 5. حساب إجمالي الطلاب (Unique Students)
    // ---------------------------------------------------------
    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);
    
    const totalUniqueStudents = allStudentIds.size;

    // ---------------------------------------------------------
    // 6. حساب الأرباح (بأمان)
    // ---------------------------------------------------------
    let totalEarnings = 0;
    
    if (courseIds.length > 0 || subjectIds.length > 0) {
        // جلب الطلبات المقبولة فقط
        const { data: allRequests, error: reqError } = await supabase
            .from('subscription_requests')
            .select('total_price, course_id, subject_id')
            .eq('status', 'approved');
        
        if (reqError) throw reqError;

        const requests = allRequests || [];

        // فلترة الطلبات الخاصة بهذا المدرس فقط
        const myRequests = requests.filter(r => 
            (r.course_id && courseIds.includes(r.course_id)) || 
            (r.subject_id && subjectIds.includes(r.subject_id))
        );

        totalEarnings = myRequests.reduce((sum, item) => sum + (item.total_price || 0), 0);
    }

    // ---------------------------------------------------------
    // 7. إرسال الرد
    // ---------------------------------------------------------
    return res.status(200).json({
      totalUniqueStudents,
      totalEarnings,
      coursesStats,
      subjectsStats
    });

  } catch (err) {
    console.error("Financial Stats Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
