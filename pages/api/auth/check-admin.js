import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  const apiName = '[API: check-admin]';
  
  // 1. التحقق الأمني: هل هذا الجهاز هو الجهاز المسجل؟
  // نمرر (req) كاملة ليقوم authHelper بقراءة الهيدرز وفحص البصمة
  const isAuthorized = await checkUserAccess(req);
  
  if (!isAuthorized) {
      console.warn(`${apiName} ⛔ Access Denied: Unauthorized Device.`);
      return res.status(403).json({ message: "Unauthorized Device" });
  }

  // 2. استخراج هوية المستخدم من الهيدر (لأنه آمن وموثق)
  let userId = req.headers['x-user-id'];
  
  // (احتياطي فقط: لو لم يجد في الهيدر يبحث في الرابط)
  if (!userId) userId = req.query.userId; 

  console.log(`${apiName} 🔍 Checking admin status for User: ${userId}`);

  if (!userId) return res.status(400).json({ message: 'Missing userId' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const isAdmin = !!(user && user.is_admin);
    console.log(`${apiName} Result: ${isAdmin}`);
    
    return res.status(200).json({ isAdmin });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    return res.status(500).json({ message: err.message });
  }
};
