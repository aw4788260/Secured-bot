import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BASE_URL } from '../../../lib/config'; // ✅ 1. استيراد ملف الإعدادات الموحد

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // ✅ 2. التحقق من App Secret (طبقة الحماية الأولى)
  // يمنع أي طلب لا يحمل الرمز السري الخاص بالتطبيق
  const appSecret = req.headers['x-app-secret'];
  if (appSecret !== process.env.APP_SECRET) {
    return res.status(403).json({ success: false, message: 'غير مصرح لك باستخدام هذا الرابط (Invalid App Secret)' });
  }

  const { identifier, password, deviceId } = req.body;

  try {
    // 3. البحث عن المستخدم
    // ✅ جلب teacher_profile_id للوصول لبيانات المدرس
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

    // 4. التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 5. إدارة بصمة الجهاز (Device Lock)
    const { data: deviceData } = await supabase
      .from('devices')
      .select('fingerprint')
      .eq('user_id', user.id)
      .maybeSingle();

    if (deviceData) {
      // إذا كان الجهاز مسجلاً مسبقاً، يجب أن يتطابق
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

    // 6. ✅ جلب صورة المدرس ومعالجة الرابط
    let profileImage = null;
    if (user.role === 'teacher' && user.teacher_profile_id) {
        const { data: teacherData } = await supabase
            .from('teachers')
            .select('profile_image')
            .eq('id', user.teacher_profile_id)
            .single();
        
        if (teacherData && teacherData.profile_image) {
            profileImage = teacherData.profile_image;
            
            // ✅ استخدام BASE_URL بدلاً من الرابط الثابت
            if (!profileImage.startsWith('http')) {
                profileImage = `${BASE_URL}/api/public/get-avatar?file=${profileImage}`;
            }
        }
    }

    // 7. إنشاء التوكن (JWT)
    const token = jwt.sign(
        { 
            userId: user.id, 
            username: user.username, 
            deviceId: deviceId 
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' } // صلاحية سنة
    );

    // حفظ التوكن في قاعدة البيانات
    const { error: updateError } = await supabase
        .from('users')
        .update({ jwt_token: token })
        .eq('id', user.id);

    if (updateError) throw updateError;

    // 8. الرد مع البيانات (شاملة رابط الصورة الكامل)
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        username: user.username,
        isAdmin: user.is_admin,
        role: user.role,
        profileImage: profileImage // ✅ يصل للتطبيق كرابط كامل جاهز للعرض
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
