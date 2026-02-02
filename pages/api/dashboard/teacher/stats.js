import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم التعامل معه داخل الدالة المساعدة

  try {
    const teacherId = user.teacherId;

    // 1. جلب أرقام الكورسات والمواد الخاصة بالمدرس
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId);

    const courseIds = courses?.map(c => c.id) || [];

    // جلب المواد التابعة للكورسات (لحساب طلاب المواد الفردية)
    let subjectIds = [];
    if (courseIds.length > 0) {
        const { data: subjects } = await supabase
            .from('subjects')
            .select('id')
            .in('course_id', courseIds);
        subjectIds = subjects?.map(s => s.id) || [];
    }

    // 2. حساب عدد الطلاب (الفريدين) بدقة
    // نستخدم Set لضمان عدم تكرار الطالب
    const uniqueStudentIds = new Set();

    // أ) المشتركون في الكورسات (مع فلترة الطلاب فقط)
    if (courseIds.length > 0) {
        const { data: courseUsers } = await supabase
            .from('user_course_access')
            // 👇 التغيير هنا: ربط داخلي مع جدول users للتأكد من الدور
            .select('user_id, users!inner(role)') 
            .in('course_id', courseIds)
            .eq('users.role', 'student'); // 👈 هذا الشرط هو الذي سيجعل الرقم 11 بدلاً من 13
        
        courseUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // ب) المشتركون في المواد الفردية (مع فلترة الطلاب فقط)
    if (subjectIds.length > 0) {
        const { data: subjectUsers } = await supabase
            .from('user_subject_access')
            // 👇 التغيير هنا أيضاً
            .select('user_id, users!inner(role)')
            .in('subject_id', subjectIds)
            .eq('users.role', 'student'); // 👈 استبعاد أي شخص ليس طالباً

        subjectUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // 3. الأرباح (من الطلبات المقبولة في جدول subscription_requests)
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('teacher_id', teacherId)
      .eq('status', 'approved');

    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    // 4. عدد الطلبات المعلقة
    const { count: pendingRequests } = await supabase
      .from('subscription_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'pending');

    // إرجاع البيانات بنفس الهيكل (مع إضافة success و stats object لضمان عمل الواجهة)
    return res.status(200).json({
      success: true,
      stats: {
        students: uniqueStudentIds.size || 0, 
        earnings: totalEarnings,
        courses: courses?.length || 0,
        pendingRequests: pendingRequests || 0,
        currency: 'EGP'
      }
    });

  } catch (err) {
    console.error("Stats API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
