import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  // 1. التحقق من هوية المتصل
  const { data: currentUser } = await supabase.from('users').select('id, is_admin').eq('session_token', sessionToken).single();
  
  if (!currentUser || !currentUser.is_admin) {
      return res.status(403).json({ error: 'Access Denied' });
  }

  // [تعديل] استخدام المتغير الجديد للمالك
  const PANEL_OWNER_ID = process.env.PANEL_OWNER_ID; 
  const isMainAdmin = String(currentUser.id) === String(PANEL_OWNER_ID);

  // ---------------------------------------------------------
  // GET: عرض المشرفين
  // ---------------------------------------------------------
  if (req.method === 'GET') {
    try {
        const { data: admins, error } = await supabase
            .from('users')
            .select('id, first_name, username, phone, created_at, admin_username')
            .eq('is_admin', true)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const formatted = admins.map(admin => ({
            ...admin,
            is_main: String(admin.id) === String(PANEL_OWNER_ID), // هل هذا الصف هو المالك؟
            has_web_access: !!admin.admin_username
        }));

        return res.status(200).json({ 
            admins: formatted, 
            isCurrentUserMain: isMainAdmin // هل المتصفح حالياً هو المالك؟
        });

    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ---------------------------------------------------------
  // POST: الإجراءات
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      if (!isMainAdmin) {
          return res.status(403).json({ error: 'عذراً، هذه الصلاحية لمالك اللوحة (Panel Owner) فقط.' });
      }

      const { action, userId, webData } = req.body;

      try {
          // ترقية
          if (action === 'promote') {
              const { data: user } = await supabase.from('users').select('id').eq('id', userId).single();
              if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
              await supabase.from('users').update({ is_admin: true }).eq('id', userId);
              return res.status(200).json({ success: true, message: 'تمت الترقية لمشرف.' });
          }

          // تنزيل (إزالة إشراف)
          if (action === 'demote') {
              if (String(userId) === String(PANEL_OWNER_ID)) return res.status(400).json({ error: 'لا يمكنك حذف نفسك!' });
              
              await supabase.from('users').update({ 
                  is_admin: false, 
                  admin_username: null, 
                  admin_password: null,
                  session_token: null // طرده فوراً
              }).eq('id', userId);
              
              return res.status(200).json({ success: true, message: 'تم سحب الصلاحية.' });
          }

          // [تعديل/إنشاء] بيانات الويب (يعمل للمالك وللآخرين)
          if (action === 'set_web_access') {
              if (!webData.username || !webData.password) return res.status(400).json({ error: 'بيانات ناقصة' });
              if (webData.password.length < 6) return res.status(400).json({ error: 'كلمة المرور قصيرة' });

              // التأكد أن الاسم غير مأخوذ (باستثناء نفس الشخص)
              const { data: existing } = await supabase
                  .from('users')
                  .select('id')
                  .eq('admin_username', webData.username)
                  .neq('id', userId) // استثناء المستخدم الحالي عند التعديل
                  .maybeSingle();
              
              if (existing) return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل.' });

              const hashedPassword = await bcrypt.hash(webData.password, 10);
              
              await supabase.from('users').update({
                  admin_username: webData.username,
                  admin_password: hashedPassword
              }).eq('id', userId);

              return res.status(200).json({ success: true, message: 'تم تحديث بيانات الدخول بنجاح.' });
          }

      } catch (err) { return res.status(500).json({ error: err.message }); }
  }
};
