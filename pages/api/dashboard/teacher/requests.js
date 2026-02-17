// pages/api/dashboard/teacher/requests.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  // ✅ تعديل: إرجاع رسالة خطأ 401 بدلاً من return فارغ لتجنب تعليق الطلب
  if (error) return res.status(401).json({ error: 'Unauthorized' });

  const teacherId = user.teacherId;

  // ==========================================================
  // --- GET: جلب الطلبات الخاصة بالمدرس (مع فلترة وتقليب صفحات) ---
  // ==========================================================
  if (req.method === 'GET') {
    const { status = 'pending', page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;

    try {
      let query = supabase
        .from('subscription_requests')
        .select('*', { count: 'exact' }) // يجلب كل البيانات ومن ضمنها السعرين
        .eq('teacher_id', teacherId)     // ✅ حماية أساسية: جلب طلبات هذا المدرس فقط
        .order('created_at', { ascending: false })
        .range(start, end);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, count, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // ✅ التعديل الجديد: تجهيز البيانات وإضافة مؤشر `has_discount` للتسهيل على واجهة العرض
      const enrichedData = data.map(request => ({
          ...request,
          has_discount: request.actual_paid_price !== null && request.actual_paid_price < request.total_price
      }));

      return res.status(200).json({ data: enrichedData, count });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ==========================================================
  // --- POST: قبول أو رفض الطلب ---
  // ==========================================================
  if (req.method === 'POST') {
    const { requestId, action, rejectionReason } = req.body;
    
    try {
      // 1. التحقق من أن الطلب يخص هذا المدرس وجلب بياناته (بما فيها كود الخصم)
      const { data: request } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .eq('teacher_id', teacherId) // ✅ حماية إضافية
        .single();

      if (!request) return res.status(404).json({ error: 'الطلب غير موجود أو لا تملك صلاحية عليه' });

      // 2. التنفيذ
      if (action === 'reject') {
         // أ. تحديث حالة الطلب إلى مرفوض
         await supabase.from('subscription_requests')
           .update({ status: 'rejected', rejection_reason: rejectionReason || 'مرفوض' })
           .eq('id', requestId);

         // ب. ♻️ إعادة تفعيل كود الخصم (إن وُجد) لكي يتمكن الطالب من استخدامه مجدداً
         if (request.discount_code_id) {
             await supabase.from('discount_codes')
               .update({ is_used: false })
               .eq('id', request.discount_code_id);
         }

         return res.status(200).json({ success: true, message: 'تم رفض الطلب وإعادة تفعيل كود الخصم (إن وجد) بنجاح' });
      }

      if (action === 'approve') {
         let targetUserId = request.user_id;

         // منطق إنشاء المستخدم إذا لم يكن موجوداً
         if (!targetUserId) {
            const { data: existing } = await supabase.from('users').select('id').eq('username', request.user_username).maybeSingle();
            if (existing) targetUserId = existing.id;
            else {
               const { data: newUser } = await supabase.from('users').insert({
                   username: request.user_username, 
                   password: request.password_hash || '123456', 
                   first_name: request.user_name, 
                   phone: request.phone, 
                   role: 'student'
               }).select('id').single();
               targetUserId = newUser.id;
            }
         }

         // منح الصلاحيات
         const items = request.requested_data || [];
         for (const item of items) {
             if (item.type === 'course') {
                 await supabase.from('user_course_access').upsert({ user_id: targetUserId, course_id: item.id }, { onConflict: 'user_id, course_id' });
             } else if (item.type === 'subject') {
                 await supabase.from('user_subject_access').upsert({ user_id: targetUserId, subject_id: item.id }, { onConflict: 'user_id, subject_id' });
             }
         }

         await supabase.from('subscription_requests').update({ status: 'approved', user_id: targetUserId }).eq('id', requestId);
         return res.status(200).json({ success: true, message: 'تم تفعيل الاشتراك بنجاح' });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
