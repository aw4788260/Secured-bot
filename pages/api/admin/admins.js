import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  // التحقق من هوية المتصل
  const { data: currentUser } = await supabase.from('users').select('id, is_admin').eq('session_token', sessionToken).single();
  
  if (!currentUser || !currentUser.is_admin) {
      return res.status(403).json({ error: 'Access Denied' });
  }

  const PANEL_OWNER_ID = process.env.PANEL_OWNER_ID; 
  const isMainAdmin = String(currentUser.id) === String(PANEL_OWNER_ID);

  // ---------------------------------------------------------
  // GET
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
  // POST
  // ---------------------------------------------------------
  if (req.method === 'POST') {
      if (!isMainAdmin) {
          return res.status(403).json({ error: 'عذراً، هذه الصلاحية لمالك اللوحة فقط.' });
      }

      const { action, userId, username, webData } = req.body;

      try {
          // 1. ترقية مشرف جديد
          if (action === 'promote') {
              if (!username) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم' });

              const { data: user } = await supabase.from('users').select('id, is_admin').eq('username', username).single();

              if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
              if (user.is_admin) return res.status(400).json({ error: 'هذا المستخدم مشرف بالفعل.' });

              await supabase.from('users').update({ is_admin: true }).eq('id', user.id);
              return res.status(200).json({ success: true, message: `تم ترقية @${username} لمشرف بنجاح.` });
          }

          // 2. إزالة مشرف
          if (action === 'demote') {
              if (String(userId) === String(PANEL_OWNER_ID)) return res.status(400).json({ error: 'لا يمكنك حذف نفسك!' });
              
              await supabase.from('users').update({ 
                  is_admin: false, 
                  admin_username: null, 
                  admin_password: null,
                  session_token: null // 🔥 طرده فوراً من النظام
              }).eq('id', userId);
              
              return res.status(200).json({ success: true, message: 'تم سحب الصلاحية.' });
          }

          // 3. [محدث] تعديل بيانات الدخول (ذكي وآمن)
          if (action === 'set_web_access') {
              // التحقق من أننا نملك يوزرنيم على الأقل
              if (!webData.username) return res.status(400).json({ error: 'اسم المستخدم مطلوب.' });

              // التحقق من عدم تكرار الاسم (مع استثناء المستخدم نفسه)
              const { data: existing } = await supabase
                  .from('users')
                  .select('id')
                  .eq('admin_username', webData.username)
                  .neq('id', userId)
                  .maybeSingle();
              
              if (existing) return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل.' });

              // تجهيز كائن التحديث
              const updates = {
                  admin_username: webData.username,
                  session_token: null // 🔥 إنهاء الجلسة فوراً لإجباره على الدخول بالبيانات الجديدة
              };

              // تحديث الباسورد فقط إذا تم إرساله
              if (webData.password && webData.password.trim() !== '') {
                  if (webData.password.length < 6) return res.status(400).json({ error: 'كلمة المرور قصيرة جداً.' });
                  updates.admin_password = await bcrypt.hash(webData.password, 10);
              }

              // تنفيذ التحديث
              await supabase.from('users').update(updates).eq('id', userId);

              return res.status(200).json({ success: true, message: 'تم تحديث البيانات وإنهاء الجلسة القديمة.' });
          }

      } catch (err) { return res.status(500).json({ error: err.message }); }
  }
};
