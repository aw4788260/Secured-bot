import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من أن المستخدم مدرس
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const teacherId = auth.teacherId;

  try {
    // ---------------------------------------------------------
    // 2. جلب الكورسات والمواد الخاصة بالمدرس
    // ---------------------------------------------------------
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title')
      .eq('teacher_id', teacherId);

    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('teacher_id', teacherId);

    const courseIds = courses.map(c => c.id);
    const subjectIds = subjects.map(s => s.id);

    // ---------------------------------------------------------
    // 3. جلب صلاحيات الوصول لحساب عدد الطلاب (اشتراك كامل وفردي)
    // ---------------------------------------------------------
    
    // أ. الطلاب المشتركون في الكورسات (Full Course)
    const { data: courseAccess } = await supabase
      .from('user_course_access')
      .select('course_id, user_id')
      .in('course_id', courseIds);

    // ب. الطلاب المشتركون في المواد (Single Subject)
    const { data: subjectAccess } = await supabase
      .from('user_subject_access')
      .select('subject_id, user_id')
      .in('subject_id', subjectIds);

    // ---------------------------------------------------------
    // 4. معالجة البيانات للإحصائيات التفصيلية
    // ---------------------------------------------------------

    // حساب عدد الطلاب لكل كورس
    const coursesStats = courses.map(course => {
      const count = courseAccess.filter(a => a.course_id === course.id).length;
      return { title: course.title, count };
    });

    // حساب عدد الطلاب لكل مادة
    const subjectsStats = subjects.map(subject => {
      const count = subjectAccess.filter(a => a.subject_id === subject.id).length;
      return { title: subject.name, count };
    });

    // ---------------------------------------------------------
    // 5. حساب إجمالي الطلاب (Unique Students)
    // ---------------------------------------------------------
    // نجمع كل الـ user_ids من الكورسات والمواد ونضعهم في Set لحذف التكرار
    const allStudentIds = new Set([
      ...courseAccess.map(a => a.user_id),
      ...subjectAccess.map(a => a.user_id)
    ]);
    
    const totalUniqueStudents = allStudentIds.size;

    // ---------------------------------------------------------
    // 6. حساب الأرباح (من الطلبات المقبولة فقط)
    // ---------------------------------------------------------
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('status', 'approved')
      .or(`course_id.in.(${courseIds.join(',')}),subject_id.in.(${subjectIds.join(',')})`); 
      // ملاحظة: الـ Syntax الخاص بـ or مع المصفوفات قد يحتاج adjustment حسب نسخة supbase-js
      // البديل الأكثر أماناً هو جلب الطلبات وفلترتها بالكود إذا كانت المصفوفة صغيرة، أو عمل استعلامين

    // طريقة بديلة وآمنة لحساب الأرباح لضمان الدقة:
    const { data: allRequests } = await supabase
        .from('subscription_requests')
        .select('total_price, course_id, subject_id')
        .eq('status', 'approved');
    
    // فلترة الطلبات الخاصة بهذا المدرس فقط
    const myRequests = allRequests.filter(r => 
        (r.course_id && courseIds.includes(r.course_id)) || 
        (r.subject_id && subjectIds.includes(r.subject_id))
    );

    const totalEarnings = myRequests.reduce((sum, item) => sum + (item.total_price || 0), 0);

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
