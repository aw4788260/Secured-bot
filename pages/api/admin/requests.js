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
  // GET: جلب الطلبات
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
        let targetUserId = request.user_id;

        // أ) التحقق: هل المستخدم موجود في جدول users؟
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', request.user_username)
            .maybeSingle();

        if (existingUser) {
            // المستخدم موجود، نستخدم الـ ID الخاص به
            targetUserId = existingUser.id;
        } else {
            // ب) إنشاء مستخدم جديد في جدول users
            // ننقل البيانات كما هي (الباسورد المشفر ينتقل لعمود password)
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    username: request.user_username,
                    password: request.password_hash, // ✅ نقل الباسورد المشفر
                    first_name: request.user_name,
                    phone: request.phone,
                    is_admin: false,
                    is_blocked: false
                })
                .select('id')
                .single();

            if (createError) throw new Error(`فشل إنشاء المستخدم: ${createError.message}`);
            
            targetUserId = newUser.id;
        }

        // ج) منح الصلاحيات (باستخدام الـ ID الرقمي الصحيح)
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

        // د) تحديث حالة الطلب وربطه بالمستخدم
        await supabase
          .from('subscription_requests')
          .update({ 
              status: 'approved',
              user_id: targetUserId // سيقبل الرقم الآن لأننا عدلنا العمود
          })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: `تم إضافة المستخدم (ID: ${targetUserId}) وتفعيل الاشتراك.` });
      }

      // === حالة الرفض (Reject) ===
      if (action === 'reject') {
        await supabase
          .from('subscription_requests')
          .update({ 
              status: 'rejected',
              rejection_reason: rejectionReason || 'تم الرفض'
          })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: 'تم رفض الطلب' });
      }

    } catch (err) {
      console.error("Error processing request:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
