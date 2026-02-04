import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  const adminUser = await requireSuperAdmin(req, res);
  if (!adminUser) return;

  // --- GET: جلب البيانات ---
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          users!teacher_profile_id (
            admin_username, 
            username,
            phone,
            is_blocked
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // تنسيق البيانات لتشمل بيانات الدخول للاثنين
      const formatted = data.map(t => ({
        ...t,
        // بيانات لوحة التحكم
        dashboard_username: t.users?.[0]?.admin_username || '',
        // بيانات التطبيق
        app_username: t.users?.[0]?.username || '',
        phone: t.users?.[0]?.phone || t.phone || '',
      }));

      return res.status(200).json(formatted);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- POST: إضافة مدرس ---
  if (req.method === 'POST') {
    const { 
        name, specialty, phone, 
        dashboard_username, dashboard_password, 
        app_username, app_password 
    } = req.body;

    if (!name || !dashboard_username || !dashboard_password || !app_username || !app_password) {
        return res.status(400).json({ error: 'الرجاء تعبئة كافة بيانات الدخول (للوحة وللتطبيق)' });
    }

    try {
      const { data: teacher, error: tError } = await supabase
        .from('teachers')
        .insert({ name, specialty, payment_details: {} })
        .select('id')
        .single();
      
      if (tError) throw tError;

      // تشفير كلمات المرور
      const hashedAdminPass = await bcrypt.hash(dashboard_password, 10);
      const hashedAppPass = await bcrypt.hash(app_password, 10);

      const { error: uError } = await supabase.from('users').insert({
        first_name: name,
        // بيانات لوحة التحكم
        admin_username: dashboard_username,
        admin_password: hashedAdminPass,
        // بيانات التطبيق
        username: app_username,
        password: hashedAppPass,
        
        role: 'teacher',
        teacher_profile_id: teacher.id,
        phone: phone,
        is_admin: false
      });

      if (uError) {
        await supabase.from('teachers').delete().eq('id', teacher.id);
        throw uError;
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- PUT: تعديل البيانات ---
  if (req.method === 'PUT') {
    const { 
        id, name, specialty, phone, 
        dashboard_username, dashboard_password, 
        app_username, app_password 
    } = req.body;
    
    try {
      await supabase.from('teachers').update({ name, specialty }).eq('id', id);

      // تجهيز تحديثات المستخدم
      const userUpdates = { 
        first_name: name,
        phone: phone,
        admin_username: dashboard_username,
        username: app_username
      };

      // تحديث كلمة مرور الداشبورد فقط إذا تم إدخالها
      if (dashboard_password && dashboard_password.trim() !== "") {
        userUpdates.admin_password = await bcrypt.hash(dashboard_password, 10);
      }

      // تحديث كلمة مرور التطبيق فقط إذا تم إدخالها
      if (app_password && app_password.trim() !== "") {
        userUpdates.password = await bcrypt.hash(app_password, 10);
      }

      const { error: uError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('teacher_profile_id', id);

      if (uError) throw uError;

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- DELETE: حذف ---
  if (req.method === 'DELETE') {
    const { id } = req.query;
    try {
      await supabase.from('users').delete().eq('teacher_profile_id', id);
      await supabase.from('teachers').delete().eq('id', id);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
