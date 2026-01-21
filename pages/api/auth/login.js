import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { identifier, password, deviceId } = req.body;

  try {
    // 1. البحث عن المستخدم (باليوزر نيم أو رقم الهاتف)
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name, username, is_admin, is_blocked')
      .or(`username.eq.${identifier},phone.eq.${identifier}`)
      .maybeSingle();

    if (!user) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ success: false, message: 'هذا الحساب محظور. تواصل مع الدعم.' });
    }

    // 2. التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 3. إدارة بصمة الجهاز (Device Lock)
    const { data: deviceData } = await supabase
      .from('devices')
      .select('fingerprint')
      .eq('user_id', user.id)
      .maybeSingle();

    if (deviceData) {
      // إذا كان مسجلاً، يجب أن يتطابق الجهاز
      if (deviceData.fingerprint !== deviceId) {
        return res.status(403).json({ 
          success: false, 
          message: 'لا يمكن الدخول من هذا الجهاز. الحساب مرتبط بجهاز آخر.' 
        });
      }
    } else {
      // تسجيل الجهاز لأول مرة
      await supabase.from('devices').insert({ 
        user_id: user.id, 
        fingerprint: deviceId 
      });
    }

    // 4. إنشاء التوكن (JWT)
    // نضع بداخله المعرف والبصمة للتأكد لاحقاً من التطابق
    const token = jwt.sign(
        { 
            userId: user.id, 
            username: user.username, 
            deviceId: deviceId 
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' } // صلاحية سنة كاملة
    );

    // 5. حفظ التوكن في العمود الجديد (jwt_token)
    // هذا يسمح لنا بطرد المستخدم لاحقاً عبر حذف هذا الحقل من الداتابيز
    const { error: updateError } = await supabase
        .from('users')
        .update({ jwt_token: token }) // ✅ هنا التعديل للعمود الجديد
        .eq('id', user.id);

    if (updateError) throw updateError;

    // 6. الرد مع التوكن
    return res.status(200).json({
      success: true,
      token, // ✅ التوكن الذي سيحفظه التطبيق ويرسله في الهيدر لاحقاً
      user: {
        id: user.id,
        firstName: user.first_name,
        username: user.username,
        isAdmin: user.is_admin
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
