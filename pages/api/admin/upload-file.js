import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // [✅] استيراد الحارس
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق الأمني (بصمة + هوية)
  const isAuthorized = await checkUserAccess(req); // يفحص الهيدرز والبصمة
  if (!isAuthorized) {
      return res.status(403).json({ error: 'Access Denied: Unauthorized Device' });
  }

  // 2. التحقق من صلاحية الأدمن (من قاعدة البيانات)
  const userId = req.headers['x-user-id']; // القراءة من الهيدر
  if (!userId) return res.status(401).json({ error: 'Missing Identity' });

  const { data: user } = await supabase.from('users').select('is_admin').eq('id', userId).single();
  if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Access Denied: Admins Only' });
  }

  // 3. إعداد المجلد
  const uploadDir = path.join(process.cwd(), 'storage', 'pdfs');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024,
    filename: (name, ext, part) => `${Date.now()}_${part.originalFilename.replace(/\s/g, '_')}`
  });

  // 4. معالجة الرفع
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload parsing failed' });

    // استخراج البيانات (formidable v3 قد يعيد مصفوفات)
    const uploadedFile = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;
    const titleRaw = fields.title ? (Array.isArray(fields.title) ? fields.title[0] : fields.title) : "";
    const chapterIdRaw = fields.chapterId ? (Array.isArray(fields.chapterId) ? fields.chapterId[0] : fields.chapterId) : null;

    if (!uploadedFile || !chapterIdRaw) {
        if(uploadedFile) fs.unlinkSync(uploadedFile.filepath);
        return res.status(400).json({ error: 'Missing file or chapterId' });
    }

    try {
        const fileName = path.basename(uploadedFile.filepath);
        
        await supabase.from('pdfs').insert({
            title: titleRaw || uploadedFile.originalFilename,
            file_path: fileName,
            chapter_id: parseInt(chapterIdRaw),
            sort_order: 0
        });
        
        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
  });
};
