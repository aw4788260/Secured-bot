// pages/api/dashboard/teacher/requests.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const teacherId = user.teacherId;

  // --- GET: جلب الطلبات المعلقة الخاصة بالمدرس ---
  if (req.method === 'GET') {
    try {
      const { data } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('teacher_id', teacherId) // ✅ الفلترة الأساسية
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- POST: قبول أو رفض الطلب ---
  if (req.method === 'POST') {
    const { requestId, action, rejectionReason } = req.body;
    
    try {
      // 1. التحقق من أن الطلب يخص هذا المدرس
      const { data: request } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .eq('teacher_id', teacherId) // ✅ حماية إضافية
        .single();

      if (!request) return res.status(404).json({ error: 'الطلب غير موجود أو لا تملك صلاحية عليه' });

      // 2. التنفيذ
      if (action === 'reject') {
         await supabase.from('subscription_requests')
           .update({ status: 'rejected', rejection_reason: rejectionReason || 'مرفوض' })
           .eq('id', requestId);
         return res.status(200).json({ success: true });
      }

      if (action === 'approve') {
         let targetUserId = request.user_id;

         // منطق إنشاء المستخدم إذا لم يكن موجوداً (نفس المنطق القديم)
         if (!targetUserId) {
            const { data: existing } = await supabase.from('users').select('id').eq('username', request.user_username).maybeSingle();
            if (existing) targetUserId = existing.id;
            else {
               const { data: newUser } = await supabase.from('users').insert({
                   username: request.user_username, password: request.password_hash || '123456', // يجب التأكد من وجود هاش
                   first_name: request.user_name, phone: request.phone, role: 'student'
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
         return res.status(200).json({ success: true });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
