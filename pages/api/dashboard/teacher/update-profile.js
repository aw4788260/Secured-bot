import { supabase } from '../../../../lib/supabaseClient';
import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import bcrypt from 'bcryptjs';

export default async (req, res) => {
  console.log(`🚀 [ProfileAPI] Request: ${req.method}`);

  // 1. التحقق من الصلاحية (استخدام dashboardHelper)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  
  if (error) {
      console.error(`❌ [ProfileAPI] Auth Failed: ${error}`);
      return; // الرد تم إرساله بواسطة dashboardHelper
  }

  const auth = {
      teacherId: user.teacherId,
      userId: user.id
  };

  console.log(`👤 [ProfileAPI] User: ${auth.userId} | TeacherID: ${auth.teacherId}`);

  // ============================================================
  // POST: تحديث البيانات
  // ============================================================
  if (req.method === 'POST') {
      const { 
          first_name, 
          last_name, 
          phone, 
          bio, 
          subject, 
          password,
          email, // في حال كنت تسمح بتغيير البريد/اسم المستخدم
          username
      } = req.body;

      console.log(`📝 [ProfileAPI] Updating profile for user ${auth.userId}...`);

      try {
          // أ) تحديث جدول المستخدمين (users)
          const userUpdates = {};
          if (first_name) userUpdates.first_name = first_name;
          if (last_name) userUpdates.last_name = last_name; // إذا كان العمود موجوداً
          if (phone) userUpdates.phone = phone;
          if (username) userUpdates.username = username;
          if (email) userUpdates.email = email;

          // تحديث كلمة المرور إذا تم إرسالها
          if (password && password.trim() !== '') {
              console.log("🔐 [ProfileAPI] Updating Password...");
              const salt = await bcrypt.genSalt(10);
              const hashedPassword = await bcrypt.hash(password, salt);
              userUpdates.password = hashedPassword;
              // userUpdates.admin_password = hashedPassword; // فك التعليق إذا كنت تريد توحيد كلمة المرور
          }

          if (Object.keys(userUpdates).length > 0) {
              const { error: userError } = await supabase
                  .from('users')
                  .update(userUpdates)
                  .eq('id', auth.userId);

              if (userError) {
                  console.error("❌ [ProfileAPI] User Update Error:", userError.message);
                  if (userError.code === '23505') return res.status(400).json({ error: 'اسم المستخدم أو الهاتف مسجل بالفعل' });
                  throw userError;
              }
          }

          // ب) تحديث جدول المعلمين (teachers)
          const teacherUpdates = {};
          if (bio !== undefined) teacherUpdates.bio = bio;
          if (subject !== undefined) teacherUpdates.subject = subject;

          if (Object.keys(teacherUpdates).length > 0 && auth.teacherId) {
              const { error: teacherError } = await supabase
                  .from('teachers')
                  .update(teacherUpdates)
                  .eq('id', auth.teacherId);

              if (teacherError) {
                  console.error("❌ [ProfileAPI] Teacher Update Error:", teacherError.message);
                  throw teacherError;
              }
          }

          console.log("✅ [ProfileAPI] Profile updated successfully.");
          return res.status(200).json({ success: true, message: 'تم تحديث الملف الشخصي بنجاح' });

      } catch (err) {
          console.error("🔥 [ProfileAPI] Exception:", err.message);
          return res.status(500).json({ error: err.message || 'حدث خطأ أثناء التحديث' });
      }
  }

  // ============================================================
  // GET: جلب البيانات الحالية (اختياري لملء النموذج)
  // ============================================================
  if (req.method === 'GET') {
      try {
          // جلب بيانات المستخدم والمعلم
          const { data: userData, error: userError } = await supabase
              .from('users')
              .select('first_name, last_name, phone, username, email')
              .eq('id', auth.userId)
              .single();

          if (userError) throw userError;

          let teacherData = {};
          if (auth.teacherId) {
              const { data: tData } = await supabase
                  .from('teachers')
                  .select('bio, subject, image')
                  .eq('id', auth.teacherId)
                  .single();
              teacherData = tData || {};
          }

          return res.status(200).json({
              success: true,
              profile: {
                  ...userData,
                  ...teacherData
              }
          });

      } catch (err) {
          console.error("🔥 [ProfileAPI] GET Error:", err.message);
          return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
