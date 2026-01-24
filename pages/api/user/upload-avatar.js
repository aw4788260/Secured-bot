import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth'; // ✅ استيراد دالة التحقق
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ✅ 1. التحقق من صلاحية المدرس قبل بدء عملية الرفع
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // إعداد مجلد الرفع على VPS
  const uploadDir = '/var/www/uploads/avatars'; 
  
  // التأكد من وجود المجلد
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 30 * 1024 * 1024, // ✅ 2. زيادة الحجم إلى 10 ميجابايت
    filename: (name, ext, part, form) => {
      // تسمية الملف: avatar_timestamp_random.ext
      return `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    }
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error("Upload Error:", err);
      // رسالة خطأ مخصصة إذا تجاوز الحجم المسموح
      if (err.message.includes('maxFileSize')) {
          return res.status(400).json({ error: 'حجم الصورة يتجاوز 10 ميجابايت' });
      }
      return res.status(500).json({ error: 'فشل رفع الملف' });
    }

    const file = files.file?.[0] || files.file;
    if (!file) return res.status(400).json({ error: 'لم يتم إرسال أي ملف' });

    // رابط الصورة العام
    const publicUrl = `https://courses.aw478260.dpdns.org/uploads/avatars/${path.basename(file.filepath)}`;

    return res.status(200).json({ success: true, url: publicUrl });
  });
};
