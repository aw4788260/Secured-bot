import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (بنفس الطريقة التي طلبتها)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم التعامل معه داخل الدالة المساعدة

  try {
    const teacherId = user.teacherId;

    // ============================================================
    // 2. جلب الكورسات والمواد (لحساب الطلاب بشكل دقيق)
    // ============================================================
    
    // أ) جلب الكورسات
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId);

    const courseIds = courses?.map(c => c.id) || [];

    // ب) جلب المواد التابعة لهذه الكورسات
    let subjectIds = [];
    if (courseIds.length > 0) {
        const { data: subjects } = await supabase
            .from('subjects')
            .select('id')
            .in('course_id', courseIds);
        subjectIds = subjects?.map(s => s.id) || [];
    }

    // ============================================================
    // 3. حساب عدد الطلاب (الفريدين)
    // ============================================================
    const uniqueStudentIds = new Set();

    // أ) الطلاب المشتركون في الكورسات
    if (courseIds.length > 0) {
        const { data: courseUsers } = await supabase
            .from('user_course_access')
            .select('user_id')
            .in('course_id', courseIds);
        
        courseUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // ب) الطلاب المشتركون في المواد الفردية
    if (subjectIds.length > 0) {
        const { data: subjectUsers } = await supabase
            .from('user_subject_access')
            .select('user_id')
            .in('subject_id', subjectIds);

        subjectUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // ============================================================
    // 4. حساب الأرباح (من جدول subscription_requests)
    // ============================================================
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('teacher_id', teacherId)
      .eq('status', 'approved'); // فقط الطلبات المقبولة

    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    // ============================================================
    // 5. عدد الطلبات المعلقة
    // ============================================================
    const { count: pendingRequests } = await supabase
      .from('subscription_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'pending');

    // ============================================================
    // 6. إرسال الرد
    // ============================================================
    return res.status(200).json({
      success: true, // ضروري لكي تفهم الواجهة أن الطلب نجح
      stats: {       // وضعنا البيانات داخل stats لتتوافق مع تصميم الداشبورد
        students: uniqueStudentIds.size || 0,
        earnings: totalEarnings,
        courses: courses?.length || 0,
        pendingRequests: pendingRequests || 0,
        views: 0,
        currency: 'EGP'
      }
    });

  } catch (err) {
    console.error("Stats Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
