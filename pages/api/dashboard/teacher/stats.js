import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية (التوافق مع dashboardHelper)
  const authResult = await requireTeacherOrAdmin(req, res);
  
  // إذا كان هناك خطأ، الدالة المساعدة أرسلت الرد، لذا نتوقف
  if (authResult.error) {
      return; 
  }

  // استخراج المستخدم بشكل آمن
  const { user } = authResult;
  const teacherId = user.teacherId;

  try {
    // =========================================================
    // 2. جلب البيانات الأساسية
    // =========================================================

    // أ) عدد الكورسات
    const { count: coursesCount, error: coursesError } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId);

    if (coursesError) throw coursesError;

    // ب) الطلبات المقبولة (لحساب الطلاب والأرباح)
    // نعتمد على subscription_requests لأنها الأدق مالياً
    const { data: approvedRequests, error: reqError } = await supabase
      .from('subscription_requests')
      .select('user_id, total_price')
      .eq('teacher_id', teacherId)
      .eq('status', 'approved');

    if (reqError) throw reqError;

    // =========================================================
    // 3. الحسابات
    // =========================================================

    let totalEarnings = 0;
    const uniqueStudentIds = new Set();

    if (approvedRequests && approvedRequests.length > 0) {
        approvedRequests.forEach(req => {
            // 1. جمع الأرباح
            totalEarnings += (req.total_price || 0);
            
            // 2. جمع الطلاب (بدون تكرار)
            if (req.user_id) {
                uniqueStudentIds.add(req.user_id);
            }
        });
    }

    // =========================================================
    // 4. إرسال الرد (بصيغة متوافقة مع الواجهة)
    // =========================================================
    
    // الواجهة تتوقع كائناً يحتوي على stats
    return res.status(200).json({
      success: true,
      stats: {
        students: uniqueStudentIds.size, // عدد الطلاب الفريدين
        courses: coursesCount || 0,      // عدد الكورسات
        earnings: totalEarnings,         // إجمالي الأرباح
        views: 0                         // (اختياري)
      }
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err.message);
    // في حالة الخطأ، نعيد أصفاراً بدلاً من تحطيم الواجهة
    return res.status(200).json({
      success: false,
      stats: { students: 0, courses: 0, earnings: 0, views: 0 },
      error: err.message
    });
  }
};
