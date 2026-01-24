import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // التأكد من طريقة الطلب
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 1. التحقق من صحة المدرس
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // التحقق من الصلاحية (مدرس فقط - في حال كان هناك مساعدين)
  if (auth.role !== 'teacher') {
      return res.status(403).json({ error: 'Only the main teacher can edit profile details' });
  }

  // 2. استقبال البيانات (البيانات الشخصية + الواتساب + قوائم الدفع + الصورة + بيانات الحساب)
  const { 
    name, 
    bio, 
    specialty, 
    whatsappNumber, // ✅ الرقم المستلم من الواجهة
    cashNumbersList, 
    instapayNumbersList, 
    instapayLinksList,
    profileImage, // ✅ الصورة الجديدة
    username,     // ✅ اسم المستخدم (للتحقق والتحديث)
    phone         // ✅ رقم الهاتف (للتحديث)
  } = req.body;

  try {
    // ✅ 3. التحقق من صحة اسم المستخدم (حروف إنجليزية وأرقام فقط بدون مسافات)
    if (username) {
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط (بدون مسافات أو رموز)' });
        }
    }

    // 4. تحديث جدول المدرسين (teachers) - البيانات المهنية والدفع والصورة
    const paymentData = {
      cash_numbers: cashNumbersList || [],        // قائمة أرقام الكاش
      instapay_numbers: instapayNumbersList || [], // قائمة أرقام إنستا باي
      instapay_links: instapayLinksList || []      // قائمة لينكات/يوزرات إنستا باي
    };

    const teacherUpdates = {
        name: name,
        bio: bio,
        specialty: specialty,
        whatsapp_number: whatsappNumber, // ✅ تحديث عمود الواتساب
        payment_details: paymentData     // ✅ تحديث عمود تفاصيل الدفع
    };

    // ✅ إضافة منطق تعديل الصورة
    if (profileImage) {
        teacherUpdates.profile_image = profileImage;
    }

    const { error: teacherError } = await supabase
      .from('teachers')
      .update(teacherUpdates)
      .eq('id', auth.teacherId);

    if (teacherError) throw teacherError;

    // 5. تحديث جدول المستخدمين (users) - اسم المستخدم ورقم الهاتف فقط
    const userUpdates = {};
    if (username) userUpdates.username = username;
    if (phone) userUpdates.phone = phone;

    if (Object.keys(userUpdates).length > 0) {
        const { error: userError } = await supabase
            .from('users')
            .update(userUpdates)
            .eq('id', auth.userId);
        
        if (userError) {
            // معالجة خطأ التكرار (اسم المستخدم أو الهاتف موجود مسبقاً)
            if (userError.code === '23505') { 
                return res.status(400).json({ error: 'اسم المستخدم أو رقم الهاتف مستخدم بالفعل.' });
            }
            throw userError;
        }
    }

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
