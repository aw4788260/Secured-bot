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
            is_main: String(admin.id) === String(PANEL_OWNER_ID),
            has_web_access: !!admin.admin_username
        }));

        return res.status(200).json({ 
            admins: formatted, 
            isCurrentUserMain: isMainAdmin 
        });

    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ---------------------------------------------------------
  // POST: الإجراءات
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      if (!isMainAdmin) {
          return res.status(403).json({ error: 'عذراً، هذه الصلاحية لمالك اللوحة فقط.' });
      }

      const { action, userId, username, webData } = req.body;

      try {
          // [تعديل] ترقية باستخدام اسم المستخدم (Username)
          if (action === 'promote') {
              if (!username) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم' });

              // البحث عن المستخدم باليوزرنيم
              const { data: user } = await supabase
                .from('users')
                .select('id, is_admin')
                .eq('username', username) // البحث بالاسم
                .single();

              if (!user) return res.status(404).json({ error: 'المستخدم غير موجود، تأكد من الاسم الصحيح.' });
              if (user.is_admin) return res.status(400).json({ error: 'هذا المستخدم مشرف بالفعل.' });

              // الترقية
              await supabase.from('users').update({ is_admin: true }).eq('id', user.id);
              return res.status(200).json({ success: true, message: `تم ترقية @${username} لمشرف بنجاح.` });
          }

          // تنزيل (إزالة إشراف)
          if (action === 'demote') {
              if (String(userId) === String(PANEL_OWNER_ID)) return res.status(400).json({ error: 'لا يمكنك حذف نفسك!' });
              
              await supabase.from('users').update({ 
                  is_admin: false, 
                  admin_username: null, 
                  admin_password: null,
                  session_token: null
              }).eq('id', userId);
              
              return res.status(200).json({ success: true, message: 'تم سحب الصلاحية.' });
          }

          // بيانات الويب
          if (action === 'set_web_access') {
              if (!webData.username || !webData.password) return res.status(400).json({ error: 'بيانات ناقصة' });
              if (webData.password.length < 6) return res.status(400).json({ error: 'كلمة المرور قصيرة' });

              const { data: existing } = await supabase
                  .from('users')
                  .select('id')
                  .eq('admin_username', webData.username)
                  .neq('id', userId)
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
