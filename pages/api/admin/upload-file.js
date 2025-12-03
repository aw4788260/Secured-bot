import { supabase } from '../../../lib/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الأدمن
  const userId = req.query.userId;
  const { data: user } = await supabase.from('users').select('is_admin').eq('id', userId).single();
  if (!user || !user.is_admin) return res.status(403).json({ error: 'Access Denied' });

  // 2. إعداد المجلد
  const uploadDir = path.join(process.cwd(), 'storage', 'pdfs');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024,
    filename: (name, ext, part) => `${Date.now()}_${part.originalFilename.replace(/\s/g, '_')}`
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload failed' });

    const uploadedFile = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;
    const title = fields.title ? (Array.isArray(fields.title) ? fields.title[0] : fields.title) : "";
    const chapterId = fields.chapterId ? (Array.isArray(fields.chapterId) ? fields.chapterId[0] : fields.chapterId) : null;

    if (!uploadedFile || !chapterId) {
        if(uploadedFile) fs.unlinkSync(uploadedFile.filepath);
        return res.status(400).json({ error: 'Missing file or chapterId' });
    }

    try {
        const fileName = path.basename(uploadedFile.filepath);
        await supabase.from('pdfs').insert({
            title: title || uploadedFile.originalFilename,
            file_path: fileName,
            chapter_id: parseInt(chapterId),
            sort_order: 0
        });
        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
  });
};
