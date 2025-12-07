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
    const { requestId, action, rejectionReason } = req.body; // action: 'approve' or 'reject'

    if (!requestId || !action) return res.status(400).json({ error: 'Missing data' });

    try {
      // 1. جلب تفاصيل الطلب
      const { data: request, error: fetchError } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });

      // --- حالة القبول (Approve) ---
      if (action === 'approve') {
        const userId = request.user_id;
        const requestedItems = request.requested_data || []; // المصفوفة التي خزنناها (كورسات ومواد)

        // أ) منح الصلاحيات في جداول الوصول
        for (const item of requestedItems) {
            if (item.type === 'course') {
                await supabase.from('user_course_access').upsert(
                    { user_id: userId, course_id: item.id },
                    { onConflict: 'user_id, course_id' }
                );
            } else if (item.type === 'subject') {
                await supabase.from('user_subject_access').upsert(
                    { user_id: userId, subject_id: item.id },
                    { onConflict: 'user_id, subject_id' }
                );
            }
        }

        // ب) تحديث حالة الطلب
        await supabase
          .from('subscription_requests')
          .update({ status: 'approved' })
          .eq('id', requestId);

        return res.status(200).json({ success: true, message: 'تم قبول الطلب وتفعيل الصلاحيات' });
      }

      // --- حالة الرفض (Reject) ---
      if (action === 'reject') {
        await supabase
          .from('subscription_requests')
          .update({ 
              status: 'rejected',
              rejection_reason: rejectionReason || 'تم الرفض من قبل الإدارة'
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
