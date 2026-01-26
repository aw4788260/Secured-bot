import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  // بداية التشخيص: طباعة نوع الطلب
  console.log(`\n[UpdateProfile] Received ${req.method} request...`);

  // 1. التحقق من صحة المدرس (Authentication)
  const auth = await verifyTeacher(req);
  if (auth.error) {
      console.error("[UpdateProfile] Auth Failed:", auth.error);
      return res.status(auth.status).json({ error: auth.error });
  }

  // [DEBUG] طباعة بيانات المدرس الذي يقوم بالعملية
  console.log(`[UpdateProfile] Authenticated User -> UserID: ${auth.userId}, TeacherID: ${auth.teacherId}`);

  // التحقق من الصلاحية (Authorization) - المدرس الرئيسي فقط
  if (auth.role !== 'teacher') {
      console.warn("[UpdateProfile] Access Denied: User is not a teacher.");
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

      // ب) جلب بيانات المستخدم من جدول users
      const { data: user } = await supabase
        .from('users')
        .select('username, phone, first_name')
        .eq('id', auth.userId)
        .single();

      // ج) معالجة رابط الصورة
      let processedImage = teacher.profile_image;
      if (processedImage && !processedImage.startsWith('http')) {
         processedImage = `https://courses.aw478260.dpdns.org/api/public/get-avatar?file=${processedImage}`;
      }

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
          user_first_name: user?.first_name || "",
          payment_details: {
            cash_numbers: paymentDetails.cash_numbers || [],
            instapay_numbers: paymentDetails.instapay_numbers || [],
            instapay_links: paymentDetails.instapay_links || [] 
          }
        }
      });

    } catch (err) {
      console.error("[UpdateProfile] GET Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ==========================================================
  // ✅ 2. معالجة طلب POST: لتحديث البيانات
  // ==========================================================
  if (req.method === 'POST') {
    // استقبال البيانات
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

    // [DEBUG LOG] طباعة البيانات القادمة من التطبيق بالكامل
    console.log("========================================");
    console.log("[UpdateProfile] INCOMING DATA FROM APP:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("========================================");

    try {
      // التحقق من صحة اسم المستخدم
      if (username) {
          const usernameRegex = /^[a-zA-Z0-9]+$/;
          if (!usernameRegex.test(username)) {
              return res.status(400).json({ error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط' });
          }
      }

      // تجهيز بيانات الدفع
      const paymentData = {
        cash_numbers: cashNumbersList || [],        
        instapay_numbers: instapayNumbersList || [], 
        instapay_links: instapayLinksList || []      
      };

      // -------------------------------------------------------
      // 1. تجهيز وتحديث جدول teachers
      // -------------------------------------------------------
      const teacherUpdates = {
          bio: bio,
          specialty: specialty,
          whatsapp_number: whatsappNumber,
          payment_details: paymentData
      };
      
      if (name) teacherUpdates.name = name;
      if (profileImage) teacherUpdates.profile_image = profileImage;

      // [DEBUG] طباعة ما سيتم إرساله لجدول Teachers
      console.log("[UpdateProfile] Updating Teachers Table with:", teacherUpdates);

      const { error: teacherError } = await supabase
        .from('teachers')
        .update(teacherUpdates)
        .eq('id', auth.teacherId);

      if (teacherError) {
          console.error("[UpdateProfile] Teacher Table Update FAILED:", teacherError);
          throw teacherError;
      }
      console.log("[UpdateProfile] ✅ Teacher Table Updated Successfully.");

      // -------------------------------------------------------
      // 2. تجهيز وتحديث جدول users
      // -------------------------------------------------------
      const userUpdates = {};
      if (username) userUpdates.username = username;
      if (phone) userUpdates.phone = phone;

      // ✅ [CRITICAL FIX] ربط الاسم بـ first_name
      if (name) {
          userUpdates.first_name = name;
      }

      if (Object.keys(userUpdates).length > 0) {
          // [DEBUG] طباعة ما سيتم إرساله لجدول Users
          console.log("[UpdateProfile] Updating Users Table with:", userUpdates);

          const { error: userError } = await supabase
              .from('users')
              .update(userUpdates)
              .eq('id', auth.userId);
          
          if (userError) {
              if (userError.code === '23505') { 
                  return res.status(400).json({ error: 'اسم المستخدم أو رقم الهاتف مستخدم بالفعل.' });
              }
              console.error("[UpdateProfile] ⚠️ User Table Update Warning:", userError);
          } else {
              console.log("[UpdateProfile] ✅ User Table Updated Successfully.");
          }
      } else {
          console.log("[UpdateProfile] No updates required for Users table.");
      }

      return res.status(200).json({ success: true, message: 'Profile updated successfully' });

    } catch (err) {
      console.error("[UpdateProfile] CRITICAL ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // طريقة غير مدعومة
  return res.status(405).json({ message: 'Method Not Allowed' });
};
