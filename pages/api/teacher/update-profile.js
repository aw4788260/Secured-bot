import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';

export default async (req, res) => {
  console.log(`\n[UpdateProfile] Received ${req.method} request...`);

  // 1. التحقق من صحة المدرس
  const auth = await verifyTeacher(req);
  if (auth.error) {
      console.error("[UpdateProfile] Auth Failed:", auth.error);
      return res.status(auth.status).json({ error: auth.error });
  }

  // التحقق من الصلاحية
  if (auth.role !== 'teacher') {
      return res.status(403).json({ error: 'Only the main teacher can edit profile details' });
  }

  // ==========================================================
  // ✅ 1. معالجة طلب GET
  // ==========================================================
  if (req.method === 'GET') {
    try {
      const { data: teacher, error } = await supabase
        .from('teachers')
        .select('name, bio, specialty, whatsapp_number, payment_details, profile_image')
        .eq('id', auth.teacherId)
        .single();

      if (error) throw error;

      const { data: user } = await supabase
        .from('users')
        .select('username, phone, first_name')
        .eq('id', auth.userId)
        .single();

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
  // ✅ 2. معالجة طلب POST
  // ==========================================================
  if (req.method === 'POST') {
    // استقبال البيانات
    const { 
      name, 
      firstName, // ✅ إضافة استقبال firstName لأن التطبيق يرسلها بهذا الاسم
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

    // ✅ توحيد متغير الاسم (نأخذ name أو firstName أيهما وصل)
    const newName = name || firstName;

    console.log("========================================");
    console.log("[UpdateProfile] INCOMING DATA FROM APP:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log(`[UpdateProfile] Resolved Name to update: "${newName}"`); // طباعة للتأكد
    console.log("========================================");

    try {
      if (username) {
          const usernameRegex = /^[a-zA-Z0-9]+$/;
          if (!usernameRegex.test(username)) {
              return res.status(400).json({ error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط' });
          }
      }

      const paymentData = {
        cash_numbers: cashNumbersList || [],        
        instapay_numbers: instapayNumbersList || [], 
        instapay_links: instapayLinksList || []      
      };

      // -------------------------------------------------------
      // 1. تحديث جدول teachers
      // -------------------------------------------------------
      const teacherUpdates = {
          bio: bio,
          specialty: specialty,
          whatsapp_number: whatsappNumber,
          payment_details: paymentData
      };
      
      // ✅ استخدام المتغير الموحد newName
      if (newName) teacherUpdates.name = newName;
      if (profileImage) teacherUpdates.profile_image = profileImage;

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
      // 2. تحديث جدول users
      // -------------------------------------------------------
      const userUpdates = {};
      if (username) userUpdates.username = username;
      if (phone) userUpdates.phone = phone;

      // ✅ استخدام المتغير الموحد newName لتحديث first_name
      if (newName) {
          userUpdates.first_name = newName;
      }

      if (Object.keys(userUpdates).length > 0) {
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
      }

      return res.status(200).json({ success: true, message: 'Profile updated successfully' });

    } catch (err) {
      console.error("[UpdateProfile] CRITICAL ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
};
