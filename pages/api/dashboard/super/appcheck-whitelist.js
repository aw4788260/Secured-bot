import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';
import { invalidateAppCheckWhitelistCache } from '../../../../lib/appCheckWhitelist';

export default async function handler(req, res) {
  // 1. حماية المسار: تأكد أن من يطلب هذا الـ API هو السوبر أدمن فقط
  const authResult = await requireSuperAdmin(req, res);
  if (authResult.error) return;

  // ==========================================================
  // 🟢 GET: جلب كل عناصر القائمة البيضاء
  // ==========================================================
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('app_check_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ items: data || [] });
    } catch (err) {
      console.error('AppCheck Whitelist Get Error:', err);
      return res.status(500).json({ error: 'فشل جلب القائمة البيضاء' });
    }
  }

  // ==========================================================
  // 🟠 POST: تنفيذ الإجراءات (إضافة / تفعيل-تعطيل / حذف)
  // ==========================================================
  if (req.method === 'POST') {
    const { action, payload } = req.body;

    try {
      // 1. إضافة عنصر جديد إلى القائمة البيضاء
      if (action === 'add') {
        const value = (payload?.value || '').trim();
        const label = (payload?.label || '').trim() || null;
        const note = (payload?.note || '').trim() || null;

        if (!value) {
          return res.status(400).json({ error: 'يجب إدخال معرّف الجهاز أو اسم المستخدم أو رقم الهاتف' });
        }

        const { error } = await supabase.from('app_check_whitelist').insert({
          value,
          label,
          note,
          is_active: true,
        });

        if (error) {
          if (error.code === '23505') {
            return res.status(400).json({ error: 'هذا المعرّف موجود بالفعل في القائمة البيضاء' });
          }
          throw error;
        }

        invalidateAppCheckWhitelistCache();
        return res.status(200).json({ success: true, message: '✅ تمت إضافة المستخدم إلى القائمة البيضاء' });
      }

      // 2. تفعيل / تعطيل عنصر
      if (action === 'toggle') {
        const { error } = await supabase
          .from('app_check_whitelist')
          .update({ is_active: payload.is_active })
          .eq('id', payload.id);

        if (error) throw error;

        invalidateAppCheckWhitelistCache();
        return res.status(200).json({
          success: true,
          message: payload.is_active ? '🟢 تم تفعيل العنصر' : '🔴 تم تعطيل العنصر',
        });
      }

      // 3. حذف عنصر نهائياً
      if (action === 'delete') {
        const { error } = await supabase.from('app_check_whitelist').delete().eq('id', payload.id);
        if (error) throw error;

        invalidateAppCheckWhitelistCache();
        return res.status(200).json({ success: true, message: '🗑️ تم الحذف من القائمة البيضاء' });
      }

      return res.status(400).json({ error: 'إجراء غير معروف' });
    } catch (err) {
      console.error('AppCheck Whitelist Admin Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
