import { supabase } from '../../../lib/supabaseClient';
import { BASE_URL } from '../../../lib/config'; // ✅ 1. استيراد ملف الإعدادات الموحد
import admin from '../../../lib/firebaseAdmin'; // ✅ إضافة استيراد فايربيز آدمن للتحقق

export default async (req, res) => {
  // السماح فقط بطلبات GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 🚀 =========================================================
  // 🚀 التحقق من Firebase App Check أولاً قبل أي شيء
  // 🚀 =========================================================
  const appCheckToken = req.headers['x-firebase-appcheck'];

  if (!appCheckToken) {
    console.error('❌ [TeacherDetails API] Missing App Check Token');
    return res.status(401).json({ error: 'Unauthorized: Missing App Check token' });
  }

  try {
    // فحص صحة التوكن عبر سيرفرات جوجل (لضمان أن الطلب من التطبيق الرسمي)
    await admin.appCheck().verifyToken(appCheckToken);
  } catch (appCheckError) {
    console.error('❌ [TeacherDetails API] App Check Failed:', appCheckError.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid App Check token' });
  }
  // =========================================================

  const { teacherId } = req.query;
  if (!teacherId) return res.status(400).json({ error: 'Missing Id' });

  try {
    // جلب بيانات المدرس (بما فيها profile_image)
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, name, bio, specialty, whatsapp_number, profile_image')
      .eq('id', teacherId)
      .single();

    if (!teacher) return res.status(404).json({ error: 'Not found' });

    // ✅ 2. معالجة رابط الصورة باستخدام BASE_URL بدلاً من الرابط الثابت
    if (teacher.profile_image && !teacher.profile_image.startsWith('http')) {
        teacher.profile_image = `${BASE_URL}/api/public/get-avatar?file=${teacher.profile_image}`;
    }

    // جلب الكورسات الخاصة بالمدرس
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, price, code') 
      .eq('teacher_id', teacherId);

    return res.status(200).json({
      ...teacher,
      courses: courses || []
    });
  } catch (err) {
    console.error("Error in get-teacher-details:", err);
    return res.status(500).json({ error: err.message });
  }
};
