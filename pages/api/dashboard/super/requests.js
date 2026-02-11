import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';

export default async function handler(req, res) {
  // 1. التحقق من صلاحية السوبر أدمن
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return; 

  // ==========================================================
  // 🟢 التعامل مع طلبات GET (جلب الطلبات مع Pagination والفلترة)
  // ==========================================================
  if (req.method === 'GET') {
    // ✅ نستقبل teacherId مع باقي المعاملات
    const { status, page = 1, limit = 10, teacherId } = req.query;

    // تحويل القيم إلى أرقام لحساب النطاق
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;

    try {
      // بناء الاستعلام الأساسي
      let query = supabase
        .from('subscription_requests')
        .select(`
            *,
            teachers (name) 
        `, { count: 'exact' }) // ✅ طلب العدد الإجمالي للصفوف
        .order('created_at', { ascending: false })
        .range(start, end); // ✅ تحديد النطاق

      // 1. تطبيق فلتر الحالة (pending, approved, rejected)
      if (status) {
        query = query.eq('status', status);
      }

      // 2. ✅ تطبيق فلتر المدرس (الجديد)
      if (teacherId && teacherId !== 'all') {
        query = query.eq('teacher_id', teacherId);
      }

      // تنفيذ الاستعلام
      const { data, count, error } = await query;

      if (error) throw error;

      // إرجاع البيانات
      return res.status(200).json({ data, count });

    } catch (err) {
      console.error("Fetch Error:", err);
      return res.status(500).json({ error: 'فشل جلب الطلبات' });
    }
  }

  // ==========================================================
  // 🟠 التعامل مع طلبات POST (تغيير الحالة: تفعيل/رفض)
  // ==========================================================
  if (req.method === 'POST') {
    const { requestId, action, rejectionReason } = req.body;

    try {
      // 1. جلب تفاصيل الطلب أولاً لمعرفة البيانات المطلوبة
      const { data: request, error: fetchError } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      // --- حالة الرفض (Reject) ---
      if (action === 'reject') {
        await supabase
          .from('subscription_requests')
          .update({ 
            status: 'rejected', 
            rejection_reason: rejectionReason || 'مرفوض من قبل الإدارة' 
          })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: 'تم رفض الطلب بنجاح' });
      }

      // --- حالة الموافقة (Approve) ---
      if (action === 'approve') {
        let targetUserId = request.user_id;

        // أ) التحقق من المستخدم أو إنشاؤه إذا لم يكن موجوداً
        // نستخدم user_username للبحث لأنه فريد
        if (!targetUserId) {
           const { data: existingUser } = await supabase
             .from('users')
             .select('id')
             .eq('username', request.user_username)
             .maybeSingle();

           if (existingUser) {
             targetUserId = existingUser.id;
           } else {
             // إنشاء مستخدم جديد إذا لم يكن موجوداً
             const { data: newUser, error: createError } = await supabase
               .from('users')
               .insert({
                   username: request.user_username,
                   password: '123456', // ⚠️ كلمة مرور افتراضية
                   first_name: request.user_name,
                   phone: request.phone,
                   role: 'student',
                   is_blocked: false
               })
               .select('id')
               .single();
             
             if (createError) throw createError;
             targetUserId = newUser.id;
           }
        }

        // ب) منح الصلاحيات (Loop through requested items)
        const items = request.requested_data || []; 
        const courseInserts = [];
        const subjectInserts = [];

        for (const item of items) {
            if (item.type === 'course') {
                courseInserts.push({ user_id: targetUserId, course_id: item.id });
            } else if (item.type === 'subject') {
                subjectInserts.push({ user_id: targetUserId, subject_id: item.id });
            }
        }

        // تنفيذ الإدخال (Upsert لمنع الأخطاء عند التكرار)
        if (courseInserts.length > 0) {
            await supabase.from('user_course_access').upsert(courseInserts, { onConflict: 'user_id, course_id' });
        }
        if (subjectInserts.length > 0) {
            await supabase.from('user_subject_access').upsert(subjectInserts, { onConflict: 'user_id, subject_id' });
        }

        // ج) تحديث حالة الطلب إلى "مقبول" وربطه بالمستخدم الفعلي
        await supabase
          .from('subscription_requests')
          .update({ 
            status: 'approved', 
            user_id: targetUserId,
            rejection_reason: null
          })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: 'تم تفعيل الاشتراك وإنشاء الحساب (إن لزم) بنجاح' });
      }

      return res.status(400).json({ error: 'إجراء غير معروف' });

    } catch (err) {
      console.error('Action Error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ العملية: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
