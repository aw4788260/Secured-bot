import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import { BASE_URL } from '../../../../lib/config';

export default async (req, res) => {
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) return;

  const teacherId = user.teacherId;
  const userId = user.id;

  // --- GET ---
  if (req.method === 'GET') {
    try {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', teacherId)
        .single();

      const { data: userData } = await supabase
        .from('users')
        .select('username, phone, first_name')
        .eq('id', userId)
        .single();

      let processedImage = teacher.profile_image;
      if (processedImage && !processedImage.startsWith('http')) {
         processedImage = `${BASE_URL}/api/public/get-avatar?file=${processedImage}`;
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
          username: userData?.username || "",
          phone: userData?.phone || "",
          payment_details: {
            cash_numbers: paymentDetails.cash_numbers || [],
            instapay_numbers: paymentDetails.instapay_numbers || [],
            instapay_links: paymentDetails.instapay_links || [] 
          }
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- POST ---
  if (req.method === 'POST') {
    const { 
      name, bio, specialty, whatsappNumber, 
      cashNumbersList, instapayNumbersList, instapayLinksList,
      profileImage, username, phone         
    } = req.body;

    try {
      // تحديث بيانات المدرس
      const teacherUpdates = {
          bio, specialty, whatsapp_number: whatsappNumber, name: name,
          payment_details: {
            cash_numbers: cashNumbersList || [],        
            instapay_numbers: instapayNumbersList || [], 
            instapay_links: instapayLinksList || []      
          }
      };
      if (profileImage) teacherUpdates.profile_image = profileImage;

      await supabase.from('teachers').update(teacherUpdates).eq('id', teacherId);

      // تحديث بيانات المستخدم
      const userUpdates = {};
      if (username) userUpdates.username = username;
      if (phone) userUpdates.phone = phone;
      if (name) userUpdates.first_name = name; // توحيد الاسم

      if (Object.keys(userUpdates).length > 0) {
          await supabase.from('users').update(userUpdates).eq('id', userId);
      }

      return res.status(200).json({ success: true });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
