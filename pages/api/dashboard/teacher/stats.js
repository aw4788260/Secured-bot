import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; // الرد تم التعامل معه داخل الدالة المساعدة

  try {
    const teacherId = user.teacherId;

    // -----------------------------------------------------------
    // أ) جلب معرفات المحتوى الخاص بالمدرس (لحساب الطلاب)
    // -----------------------------------------------------------
    
    // 1. جلب الكورسات
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId);

    const courseIds = courses?.map(c => c.id) || [];

    // 2. جلب المواد (Subjects) التابعة لهذه الكورسات
    // (ضروري لأن الطالب قد يكون مشتركاً في مادة فقط وليس الكورس كامل)
    let subjectIds = [];
    if (courseIds.length > 0) {
        const { data: subjects } = await supabase
            .from('subjects')
            .select('id')
            .in('course_id', courseIds);
        subjectIds = subjects?.map(s => s.id) || [];
    }

    // -----------------------------------------------------------
    // ب) حساب عدد الطلاب الفريدين (Unique Students)
    // -----------------------------------------------------------
    const uniqueStudentIds = new Set();

    // 1. المشتركون في الكورسات
    if (courseIds.length > 0) {
        const { data: courseUsers } = await supabase
            .from('user_course_access')
            .select('user_id')
            .in('course_id', courseIds);
        
        courseUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // 2. المشتركون في المواد الفردية
    if (subjectIds.length > 0) {
        const { data: subjectUsers } = await supabase
            .from('user_subject_access')
            .select('user_id')
            .in('subject_id', subjectIds);

        subjectUsers?.forEach(row => uniqueStudentIds.add(row.user_id));
    }

    // -----------------------------------------------------------
    // ج) حساب الأرباح والطلبات المعلقة (من جدول subscription_requests)
    // -----------------------------------------------------------
    
    // 1. الأرباح (من الطلبات المقبولة فقط)
    const { data: earningsData } = await supabase
      .from('subscription_requests')
      .select('total_price')
      .eq('teacher_id', teacherId)
      .eq('status', 'approved');

    const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

    // 2. عدد الطلبات المعلقة (Pending)
    const { count: pendingRequests } = await supabase
      .from('subscription_requests')
      .select('*', { count: 'exact', head: true }) // head: true تعني جلب العدد فقط بدون البيانات
      .eq('teacher_id', teacherId)
      .eq('status', 'pending');

    // -----------------------------------------------------------
    // د) إرسال الرد
    // -----------------------------------------------------------
    return res.status(200).json({
      success: true,
      stats: {
        students: uniqueStudentIds.size, // العدد الفعلي للطلاب بدون تكرار
        earnings: totalEarnings,
        courses: courses?.length || 0,
        pendingRequests: pendingRequests || 0,
        views: 0 // يمكن تفعيله لاحقاً
      }
    });

  } catch (err) {
    console.error("Stats API Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
