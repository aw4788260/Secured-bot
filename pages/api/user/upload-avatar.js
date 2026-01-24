import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';
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

  // 1. التحقق من الصلاحية
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // 2. مسار التخزين (كما هو)
  const uploadDir = '/www/wwwroot/secured-bot-prod/storage/avatars';
  
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (error) {
      console.error("Directory Creation Error:", error);
      return res.status(500).json({ error: 'فشل إنشاء مجلد التخزين' });
    }
  }

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filename: (name, ext, part, form) => {
      return `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    }
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error("Upload Error:", err);
      return res.status(500).json({ error: 'فشل رفع الملف' });
    }

    const file = files.file?.[0] || files.file;
    if (!file) return res.status(400).json({ error: 'لم يتم إرسال أي ملف' });

    const fileName = path.basename(file.filepath);
    
    // ✅ التعديل هنا: الرابط أصبح يوجه للـ API الجديد
    const publicUrl = `https://courses.aw478260.dpdns.org/api/public/get-avatar?file=${fileName}`;

    return res.status(200).json({ success: true, url: publicUrl });
  });
};
