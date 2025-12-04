import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

// ✅ هذا هو الحل: إلغاء حد حجم الرد (Response Limit)
// يسمح هذا بإرسال ملفات أكبر من 4MB عبر الـ API
export const config = {
  api: {
    responseLimit: false,
  },
};

export default async (req, res) => {
  const { pdfId, userId, deviceId } = req.query;
  if (!pdfId || !userId || !deviceId) return res.status(400).json({ message: "Missing data" });

  try {
    // 1. التحقق الأمني
    const hasAccess = await checkUserAccess(userId, null, pdfId, null, deviceId);
    if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

    // 2. جلب المسار
    const { data } = await supabase.from('pdfs').select('file_path, title').eq('id', pdfId).single();
    if (!data) return res.status(404).json({ message: "Not found" });

    const filePath = path.join(process.cwd(), 'storage', 'pdfs', data.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File missing" });

    // 3. إعداد الكاش والتدفق
    const stat = fs.statSync(filePath);
    
    // تنظيف الهيدرز
    res.removeHeader('Set-Cookie');
    res.removeHeader('Pragma');
    res.removeHeader('Expires');

    // إعدادات الكاش ونوع الملف
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); 
    res.setHeader('Surrogate-Control', 'public, max-age=31536000'); 
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(data.title)}.pdf"`);

    // إرسال الملف كـ Stream
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

  } catch (err) {
    console.error("PDF API Error:", err);
    // تأكد من عدم إرسال رد JSON إذا كان الـ Stream قد بدأ بالفعل
    if (!res.headersSent) {
        res.status(500).json({ message: err.message });
    }
  }
};
