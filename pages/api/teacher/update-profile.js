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

  // 2. استقبال البيانات (البيانات الشخصية + الواتساب + قوائم الدفع + الصورة)
  const { 
    name, 
    bio, 
    specialty, 
    whatsappNumber, // ✅ الرقم المستلم من الواجهة
    cashNumbersList, 
    instapayNumbersList, 
    instapayLinksList,
    profileImage // ✅ الصورة الجديدة
  } = req.body;

  try {
    // 3. تجهيز هيكل بيانات الدفع (JSON)
    const paymentData = {
      cash_numbers: cashNumbersList || [],        // قائمة أرقام الكاش
      instapay_numbers: instapayNumbersList || [], // قائمة أرقام إنستا باي
      instapay_links: instapayLinksList || []      // قائمة لينكات/يوزرات إنستا باي
    };

    // تجهيز كائن التحديث
    const updates = {
        name: name,
        bio: bio,
        specialty: specialty,
        whatsapp_number: whatsappNumber, // ✅ تحديث عمود الواتساب
        payment_details: paymentData     // ✅ تحديث عمود تفاصيل الدفع
    };

    // ✅ إضافة منطق تعديل الصورة (إضافتها للكائن فقط إذا تم إرسالها)
    if (profileImage) {
        updates.profile_image = profileImage;
    }

    // 4. التحديث في قاعدة البيانات (جدول teachers)
    const { error } = await supabase
      .from('teachers')
      .update(updates)
      .eq('id', auth.teacherId);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
