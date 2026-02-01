import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  // 1. التحقق من الصلاحية
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return; 

  const teacherId = user.teacherId;

  try {
    // ---------------------------------------------------------
    // 1. جلب عدد الكورسات (فقط العدد)
    // ---------------------------------------------------------
    const { count: coursesCount, error: coursesError } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true }) // head: true تعني لا تجلب البيانات، فقط العدد
      .eq('teacher_id', teacherId);

    if (coursesError) throw coursesError;

    // ---------------------------------------------------------
    // 2. حساب الأرباح والطلاب من جدول طلبات الاشتراك
    // ---------------------------------------------------------
    // نعتمد على الطلبات التي حالتها "approved" فقط لأنها المدفوعة
    const { data: requests, error: requestsError } = await supabase
      .from('subscription_requests')
      .select('total_price, user_id')
      .eq('teacher_id', teacherId)
      .eq('status', 'approved'); // شرط أساسي: الطلب مقبول

    if (requestsError) throw requestsError;

    // ---------------------------------------------------------
    // 3. العمليات الحسابية
    // ---------------------------------------------------------
    
    let totalEarnings = 0;
    // نستخدم Set لحساب عدد الطلاب الفريدين (بدون تكرار)
    const uniqueStudents = new Set();

    requests.forEach(req => {
        // جمع الأرباح من عمود total_price
        if (req.total_price) {
            totalEarnings += req.total_price;
        }
        
        // إضافة الطالب للقائمة الفريدة
        if (req.user_id) {
            uniqueStudents.add(req.user_id);
        }
    });

    // ---------------------------------------------------------
    // 4. إرسال النتيجة
    // ---------------------------------------------------------
    return res.status(200).json({
      success: true,
      stats: {
        students: uniqueStudents.size, // عدد الطلاب الذين اشتروا بالفعل
        courses: coursesCount || 0,
        earnings: totalEarnings,       // إجمالي المبالغ من الطلبات المقبولة
        views: 0 // يمكن تفعيله لاحقاً إذا وجد جدول مشاهدات
      }
    });

  } catch (err) {
    console.error("Stats API Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
