import { supabase } from '../../../lib/supabaseClient';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';

export default async (req, res) => {
  // طباعة وقت الطلب
  console.log(`\n🚀 [Admin Login] Start Request at ${new Date().toISOString()}`);

  if (req.method !== 'POST') {
    console.log(`❌ [Error] Invalid Method: ${req.method}`);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;
  console.log(`👤 [Input] Username: "${username}"`);

  try {
    // 1. البحث باستخدام admin_username
    console.log('🔍 [Step 1] Searching for user in DB...');
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('id, admin_password, is_admin, role, is_blocked, teacher_profile_id, first_name, admin_username')
      .eq('admin_username', username)
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 تعني غير موجود
        console.error('❌ [Step 1] Database Error:', dbError);
    }

    if (!user) {
        console.log('❌ [Step 1] User NOT Found.');
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
    console.log(`✅ [Step 1] User Found: ID=${user.id}, Role=${user.role}, IsAdmin=${user.is_admin}`);

    // 2. التحقق من كلمة المرور
    console.log('🔑 [Step 2] Checking password...');
    
    if (!user.admin_password) {
        console.log('❌ [Step 2] User has NO admin_password set in DB.');
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.admin_password);
    console.log(`🔐 [Step 2] Password Match Result: ${isMatch ? 'SUCCESS' : 'FAILED'}`);

    if (!isMatch) {
        return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    // 3. التحقق من الصلاحيات
    console.log('🛡️ [Step 3] Checking permissions...');
    const isSuperAdmin = user.is_admin === true || user.role === 'super_admin';
    const isTeacher = user.role === 'teacher';
    
    console.log(`   👉 Is Super Admin? ${isSuperAdmin}`);
    console.log(`   👉 Is Teacher? ${isTeacher}`);

    if (!isSuperAdmin && !isTeacher) {
        console.log('⛔ [Step 3] Access Denied: User is neither Super Admin nor Teacher.');
        return res.status(403).json({ success: false, message: 'غير مصرح لك بدخول لوحة التحكم.' });
    }

    // 4. فحص الحظر
    console.log(`🚫 [Step 4] Checking Block Status: ${user.is_blocked}`);
    if (user.is_blocked) {
        console.log('⛔ [Step 4] User is BLOCKED.');
        return res.status(403).json({ success: false, message: 'هذا الحساب محظور.' });
    }

    // 5. توليد وحفظ توكن الجلسة
    console.log('🔄 [Step 5] Generating Session Token...');
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
        .from('users')
        .update({ session_token: newSessionToken })
        .eq('id', user.id);

    if (updateError) {
        console.error('❌ [Step 5] Update Token Error:', updateError);
        throw updateError;
    }
    console.log('✅ [Step 5] Session Token Saved to DB.');

    // 6. إعداد الكوكيز
    console.log('🍪 [Step 6] Setting Cookie...');
    const cookie = serialize('admin_session', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 ساعة
      path: '/'
    });

    res.setHeader('Set-Cookie', cookie);

    console.log('🚀 [Success] Login Successful. Sending Response.');
    return res.status(200).json({
        success: true,
        userId: user.id,
        role: isSuperAdmin ? 'super_admin' : 'teacher',
        name: user.first_name || user.admin_username
    });

  } catch (err) {
    console.error("💥 [CRITICAL ERROR] Login Exception:", err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
