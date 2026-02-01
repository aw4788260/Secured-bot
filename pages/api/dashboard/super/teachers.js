// pages/api/dashboard/super/teachers.js
import { supabase } from '../../../../lib/supabaseClient';
import { requireSuperAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  const adminUser = await requireSuperAdmin(req, res);
  if (!adminUser) return;

  // --- GET: قائمة المدرسين ---
  if (req.method === 'GET') {
    // نجلب المدرسين مع ربطهم بالمستخدم (لمعرفة اسم المستخدم للدخول)
    const { data } = await supabase
      .from('teachers')
      .select('*, users!teacher_profile_id(admin_username, is_blocked)')
      .order('created_at', { ascending: false });
      
    return res.status(200).json(data);
  }

  // --- POST: إضافة مدرس جديد ---
  if (req.method === 'POST') {
    const { name, username, password, phone, specialty } = req.body;

    if (!name || !username || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

    try {
      // 1. إنشاء بروفايل المدرس
      const { data: teacherProfile, error: tError } = await supabase
        .from('teachers')
        .insert({ name, specialty, payment_details: {} })
        .select('id')
        .single();
      
      if (tError) throw tError;

      // 2. تشفير كلمة المرور
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. إنشاء حساب المستخدم (Admin User)
      const { error: uError } = await supabase.from('users').insert({
        first_name: name,
        admin_username: username,
        admin_password: hashedPassword, // كلمة المرور للداشبورد
        username: `teacher_${Date.now()}`, // اسم مستخدم وهمي للتطبيق (غير مستخدم)
        role: 'teacher',
        teacher_profile_id: teacherProfile.id,
        is_admin: false,
        phone: phone
      });

      if (uError) throw uError;

      return res.status(200).json({ success: true });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
