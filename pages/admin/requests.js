import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  // 1. التحقق الأمني (هل أنت أدمن؟)
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;

  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  const { data: adminUser } = await supabase
    .from('users')
    .select('is_admin')
    .eq('session_token', sessionToken)
    .single();

  if (!adminUser || !adminUser.is_admin) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  // ---------------------------------------------------------
  // GET: جلب الطلبات المعلقة
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ---------------------------------------------------------
  // POST: معالجة الطلب (قبول أو رفض)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    const { requestId, action, rejectionReason } = req.body; 

    if (!requestId || !action) return res.status(400).json({ error: 'Missing data' });

    try {
      // 1. جلب بيانات الطلب بالكامل
      const { data: request, error: fetchError } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });

      // === حالة القبول (Approve) ===
      if (action === 'approve') {
        let targetUserId = request.user_id; // قد يكون فارغاً إذا كان طالباً جديداً

        // أ) التحقق: هل المستخدم موجود في جدول users؟
        // نبحث باسم المستخدم (username) لأنه فريد
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', request.user_username)
            .maybeSingle();

        if (existingUser) {
            // المستخدم موجود سابقاً (ربما يجدد اشتراك أو يشتري مادة جديدة)
            targetUserId = existingUser.id;
        } else {
            // ب) المستخدم جديد: يجب إنشاء حساب له الآن
            // هنا سيتم توليد الـ ID تلقائياً (100000+)
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    username: request.user_username,
                    password: request.password_hash, // نستخدم الباسورد المشفر الموجود في الطلب
                    first_name: request.user_name,
                    phone: request.phone,
                    is_admin: false,
                    is_blocked: false
                })
                .select('id') // نطلب من القاعدة إرجاع الـ ID الجديد
                .single();

            if (createError) throw new Error(`فشل إنشاء المستخدم: ${createError.message}`);
            
            targetUserId = newUser.id; // هذا هو الـ ID المكون من 6 أرقام
        }

        // ج) منح الصلاحيات (باستخدام ID المستخدم الحقيقي)
        const requestedItems = request.requested_data || [];

        for (const item of requestedItems) {
            if (item.type === 'course') {
                await supabase.from('user_course_access').upsert(
                    { user_id: targetUserId, course_id: item.id },
                    { onConflict: 'user_id, course_id' }
                );
            } else if (item.type === 'subject') {
                await supabase.from('user_subject_access').upsert(
                    { user_id: targetUserId, subject_id: item.id },
                    { onConflict: 'user_id, subject_id' }
                );
            }
        }

        // د) تحديث حالة الطلب + حفظ الـ ID الجديد في سجل الطلب
        // لكي يظهر في الفاتورة أو لكي يعرف الأدمن رقم الطالب
        await supabase
          .from('subscription_requests')
          .update({ 
              status: 'approved',
              user_id: targetUserId // نحدث الحقل ليحتوي الـ ID الحقيقي
          })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: `تم إنشاء حساب للطالب (ID: ${targetUserId}) وتفعيل الاشتراك بنجاح.` });
      }

      // === حالة الرفض (Reject) ===
      if (action === 'reject') {
        await supabase
          .from('subscription_requests')
          .update({ 
              status: 'rejected',
              rejection_reason: rejectionReason || 'رفض إداري'
          })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: 'تم رفض الطلب' });
      }

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
