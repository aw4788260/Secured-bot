import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { username, password, deviceId } = req.body;

  try {
    // 1. البحث عن المستخدم
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name, username, is_admin, is_blocked')
      .eq('username', username)
      .single();

    if (!user) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 2. التحقق من الحظر
    if (user.is_blocked) {
      return res.status(403).json({ success: false, message: 'هذا الحساب محظور. تواصل مع الدعم.' });
    }

    // 3. التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 4. نظام قفل الجهاز (Device Fingerprint)
    if (deviceId) {
      const { data: deviceData } = await supabase
        .from('devices')
        .select('fingerprint')
        .eq('user_id', user.id)
        .maybeSingle();

      if (deviceData) {
        // إذا كان المستخدم مسجلاً بجهاز سابق، يجب أن يتطابق
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
    } else {
      return res.status(400).json({ success: false, message: 'معرف الجهاز مفقود.' });
    }

    // 5. إرجاع البيانات بنجاح
    return res.status(200).json({
      success: true,
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
