import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // فقط المعلم الرئيسي يمكنه إضافة مشرفين (المشرف لا يضيف مشرفاً)
  if (auth.role !== 'teacher') {
      return res.status(403).json({ error: 'Only main teachers can add moderators' });
  }

  const { name, username, password, phone } = req.body;

  try {
      // التحقق من التكرار
      const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
      if (existing) return res.status(400).json({ error: 'Username taken' });

      const hashedPassword = await bcrypt.hash(password, 10);

      await supabase.from('users').insert({
          first_name: name,
          username: username,
          password: hashedPassword,
          phone: phone,
          role: 'moderator', // الصلاحية
          teacher_profile_id: auth.teacherId // الربط بنفس المدرس
      });

      return res.status(200).json({ success: true, message: 'Moderator added' });

  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
};
