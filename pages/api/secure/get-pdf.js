import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

// إلغاء حد حجم الرد للسماح بالملفات الكبيرة
export const config = {
  api: { responseLimit: false },
};

export default async (req, res) => {
  const { pdfId } = req.query;

  if (!pdfId) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).json({ message: "Missing pdfId" });
  }

  try {
    // 1. التحقق الأمني عبر الهيدرز
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    
    if (!hasAccess) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(403).json({ message: "Access Denied" });
    }

    // 2. جلب مسار الملف
    const { data } = await supabase.from('pdfs').select('file_path, title').eq('id', pdfId).single();
    if (!data) return res.status(404).json({ message: "Not found" });

    const fullPath = path.join(process.cwd(), 'storage', 'pdfs', data.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "File missing on server" });

    // 3. إرسال الملف (Stream)
    const stat = fs.statSync(fullPath);
    
    // إعدادات الكاش
    res.setHeader('Cache-Control', 'private, max-age=3600'); 
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(data.title)}.pdf"`);

    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);

  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};
