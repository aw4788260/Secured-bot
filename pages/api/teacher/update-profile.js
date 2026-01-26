import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // 1. التحقق من صحة المدرس (Authentication)
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // التحقق من الصلاحية (Authorization) - المدرس الرئيسي فقط
  if (auth.role !== 'teacher') {
      return res.status(403).json({ error: 'Only the main teacher can edit profile details' });
  }

  // ==========================================================
  // ✅ 1. معالجة طلب GET: لجلب البيانات الحالية
  // ==========================================================
  if (req.method === 'GET') {
    try {
      // أ) جلب بيانات المدرس من جدول teachers
      const { data: teacher, error } = await supabase
        .from('teachers')
        .select('name, bio, specialty, whatsapp_number, payment_details, profile_image')
        .eq('id', auth.teacherId)
        .single();

      if (error) throw error;

      // ب) جلب بيانات المستخدم (للاسم والهاتف) من جدول users
      const { data: user } = await supabase
        .from('users')
        .select('username, phone')
        .eq('id', auth.userId)
        .single();

      // ج) معالجة رابط الصورة
      let processedImage = teacher.profile_image;
      if (processedImage && !processedImage.startsWith('http')) {
         processedImage = `https://courses.aw478260.dpdns.org/api/public/get-avatar?file=${processedImage}`;
      }

      // د) تجهيز هيكل بيانات الدفع
      const paymentDetails = teacher.payment_details || {};

      return res.status(200).json({
        success: true,
        data: {
          name: teacher.name,
          bio: teacher.bio || "",
          specialty: teacher.specialty || "",
          whatsapp_number: teacher.whatsapp_number || "",
          profile_image: processedImage,
          username: user?.username || "",
          phone: user?.phone || "",
          payment_details: {
            cash_numbers: paymentDetails.cash_numbers || [],
            instapay_numbers: paymentDetails.instapay_numbers || [],
            instapay_links: paymentDetails.instapay_links || [] 
          }
        }
      });

    } catch (err) {
      console.error("Fetch Profile Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ==========================================================
  // ✅ 2. معالجة طلب POST: لتحديث البيانات
  // ==========================================================
  if (req.method === 'POST') {
    // استقبال البيانات من جسم الطلب
    const { 
      name, 
      bio, 
      specialty, 
      whatsappNumber, 
      cashNumbersList, 
      instapayNumbersList, 
      instapayLinksList,
      profileImage, 
      username,      
      phone          
    } = req.body;

    try {
      // التحقق من صحة اسم المستخدم (حروف إنجليزية وأرقام فقط) - كما طلبت بدون تعديل
      if (username) {
          const usernameRegex = /^[a-zA-Z0-9]+$/;
          if (!usernameRegex.test(username)) {
              return res.status(400).json({ error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط (بدون مسافات أو رموز)' });
          }
      }

      // تجهيز كائن تفاصيل الدفع (JSON)
      const paymentData = {
        cash_numbers: cashNumbersList || [],        
        instapay_numbers: instapayNumbersList || [], 
        instapay_links: instapayLinksList || []      
      };

      // تجهيز بيانات تحديث المدرس (بما فيها الاسم الأول والثاني الموجود في حقل name)
      const teacherUpdates = {
          name: name,
          bio: bio,
          specialty: specialty,
          whatsapp_number: whatsappNumber,
          payment_details: paymentData
      };

      if (profileImage) {
          teacherUpdates.profile_image = profileImage;
      }

      // [تعديل هام جداً]: إضافة .select() للتحقق من أن التحديث تم فعلاً
      const { data: updatedTeacher, error: teacherError } = await supabase
        .from('teachers')
        .update(teacherUpdates)
        .eq('id', auth.teacherId)
        .select(); // ✅ هذا السطر هو الحل

      if (teacherError) throw teacherError;

      // ✅ التحقق: هل تم تعديل الصف فعلاً؟ إذا كانت المصفوفة فارغة فهذا يعني أن ID المدرس خطأ
      if (!updatedTeacher || updatedTeacher.length === 0) {
          return res.status(404).json({ error: 'فشل تحديث البيانات: لم يتم العثور على سجل المدرس. تأكد من الحساب المسجل.' });
      }

      // تحديث جدول users (اسم المستخدم والهاتف)
      const userUpdates = {};
      if (username) userUpdates.username = username;
      if (phone) userUpdates.phone = phone;

      if (Object.keys(userUpdates).length > 0) {
          // [تعديل هام]: إضافة .select() هنا أيضاً
          const { data: updatedUser, error: userError } = await supabase
              .from('users')
              .update(userUpdates)
              .eq('id', auth.userId)
              .select(); // ✅
          
          if (userError) {
              if (userError.code === '23505') { 
                  return res.status(400).json({ error: 'اسم المستخدم أو رقم الهاتف مستخدم بالفعل.' });
              }
              throw userError;
          }

          // ✅ التحقق من تحديث المستخدم
          if (!updatedUser || updatedUser.length === 0) {
             return res.status(404).json({ error: 'فشل تحديث بيانات المستخدم (الهاتف/اليوزر): الحساب غير موجود.' });
          }
      }

      return res.status(200).json({ success: true, message: 'Profile updated successfully' });

    } catch (err) {
      console.error("Update Profile Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // إذا لم تكن الطريقة GET أو POST
  return res.status(405).json({ message: 'Method Not Allowed' });
};
