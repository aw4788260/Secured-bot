// pages/api/dashboard/super/teachers.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  const adminUser = await requireSuperAdmin(req, res);
  if (!adminUser) return;

  // --- GET: جلب القائمة الأساسية (خفيف وسريع) ---
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          users!teacher_profile_id (
            admin_username, 
            phone,
            is_blocked
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // تنسيق بسيط للبيانات للعرض في الجدول
      const formatted = data.map(t => ({
        ...t,
        username: t.users?.[0]?.admin_username || '',
        phone: t.users?.[0]?.phone || t.phone || '',
        // لن نحسب الطلاب والأرباح هنا لتخفيف الضغط
      }));

      return res.status(200).json(formatted);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- POST: إضافة مدرس وحسابه ---
  if (req.method === 'POST') {
    const { name, username, password, phone, specialty } = req.body;

    if (!name || !username || !password) return res.status(400).json({ error: 'البيانات ناقصة' });

    try {
      // 1. إنشاء المدرس
      const { data: teacher, error: tError } = await supabase
        .from('teachers')
        .insert({ name, specialty, payment_details: {} })
        .select('id')
        .single();
      
      if (tError) throw tError;

      // 2. إنشاء المستخدم (Admin Login)
      const hashedPassword = await bcrypt.hash(password, 10);
      const { error: uError } = await supabase.from('users').insert({
        first_name: name,
        admin_username: username,
        admin_password: hashedPassword,
        username: `teacher_${Date.now()}_${Math.floor(Math.random() * 100)}`, // اسم مستخدم فريد
        role: 'teacher',
        teacher_profile_id: teacher.id,
        phone: phone,
        is_admin: false
      });

      if (uError) {
        // تراجع: حذف المدرس إذا فشل إنشاء المستخدم
        await supabase.from('teachers').delete().eq('id', teacher.id);
        throw uError;
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- PUT: تعديل البيانات (شاملة الدخول) ---
  if (req.method === 'PUT') {
    const { id, name, specialty, phone, password, username } = req.body;
    
    try {
      // 1. تحديث جدول teachers
      const { error: tError } = await supabase
        .from('teachers')
        .update({ name, specialty })
        .eq('id', id);

      if (tError) throw tError;

      // 2. تحديث جدول users
      const userUpdates = { 
        first_name: name,
        phone: phone,
        admin_username: username 
      };

      // تحديث كلمة المرور فقط إذا كتبت
      if (password && password.trim() !== "") {
        userUpdates.admin_password = await bcrypt.hash(password, 10);
      }

      const { error: uError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('teacher_profile_id', id); // الربط عبر teacher_profile_id

      if (uError) throw uError;

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- DELETE: حذف كامل ---
  if (req.method === 'DELETE') {
    const { id } = req.query;
    try {
      // حذف المستخدم المرتبط أولاً
      await supabase.from('users').delete().eq('teacher_profile_id', id);
      // حذف المدرس
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
