import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس
import { serialize } from 'cookie';

export default async (req, res) => {
  // 2. محاولة التعرف على المستخدم
  // حتى لو كان التوكن منتهي الصلاحية، نحاول استخراج المعرف لإبطال الجلسة في القاعدة
  // لكن checkUserAccess سيعيد false إذا كان التوكن غير صالح، لذا نعتمد عليه للتحقق الأولي
  
  // ملاحظة: في حالة تسجيل الخروج، لا يهمنا بصمة الجهاز بقدر ما يهمنا إبطال التوكن
  await checkUserAccess(req); 
  
  // نستقبل المعرف (قد يكون undefined إذا فشل التحقق، وهذا مقبول في حالة الخروج)
  const userId = req.headers['x-user-id'];

  if (userId) {
      try {
          // 3. حذف التوكن من قاعدة البيانات (إبطال الجلسة تماماً)
          await supabase
              .from('users')
              .update({ jwt_token: null }) // تصفير التوكن
              .eq('id', userId);
              
          console.log(`User ${userId} logged out and token revoked.`);
      } catch (err) {
          console.error("Logout DB Error:", err.message);
      }
  }

  // 4. مسح الكوكيز (الخاصة بلوحة التحكم Admin)
  const cookie = serialize('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    expires: new Date(0), // تاريخ قديم للحذف فوراً
    sameSite: 'strict',
    path: '/'
  });

  res.setHeader('Set-Cookie', cookie);
  
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};
