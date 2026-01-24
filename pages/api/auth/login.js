import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { identifier, password, deviceId } = req.body;

  try {
    // 1. البحث عن المستخدم
    // ✅ تمت إضافة teacher_profile_id للاستعلام لنتمكن من جلب الصورة لاحقاً
    const { data: user } = await supabase
      .from('users')
      .select('id, password, first_name, username, is_admin, is_blocked, role, teacher_profile_id') 
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

    // 4. ✅ خطوة جديدة: جلب صورة المدرس من جدول teachers
    let profileImage = null;
    if (user.role === 'teacher' && user.teacher_profile_id) {
        const { data: teacherData } = await supabase
            .from('teachers')
            .select('profile_image')
            .eq('id', user.teacher_profile_id)
            .single();
        
        if (teacherData) profileImage = teacherData.profile_image;
    }

    // 5. إنشاء التوكن (JWT)
    const token = jwt.sign(
        { 
            userId: user.id, 
            username: user.username, 
            deviceId: deviceId 
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' } // صلاحية سنة كاملة
    );

    // حفظ التوكن في العمود الجديد
    const { error: updateError } = await supabase
        .from('users')
        .update({ jwt_token: token })
        .eq('id', user.id);

    if (updateError) throw updateError;

    // 6. الرد مع التوكن والبيانات (شاملة الصورة والرتبة)
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        username: user.username,
        isAdmin: user.is_admin,
        role: user.role,
        profileImage: profileImage // ✅ تم إرجاع الصورة هنا
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
