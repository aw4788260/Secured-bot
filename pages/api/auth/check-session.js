import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  // 1. قراءة الكوكيز من الهيدر
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  
  if (!sessionToken) {
    return res.status(401).json({ valid: false, message: 'No Token' });
  }

  try {
    // 2. البحث عن المستخدم صاحب هذا التوكن
    // [تصحيح] إضافة first_name للاستعلام
    const { data: user, error } = await supabase
      .from('users')
      .select('id, session_token, is_admin, first_name')
      .eq('session_token', sessionToken)
      .single();

    // 3. التحقق من التطابق والصلاحية
    if (error || !user || !user.is_admin) {
      return res.status(401).json({ valid: false });
    }

    // [تصحيح] إرجاع الاسم في الرد
    return res.status(200).json({ 
        valid: true, 
        userId: user.id,
        name: user.first_name // هذا ما ينتظره AdminLayout
    });

  } catch (err) {
    return res.status(500).json({ valid: false });
  }
};
