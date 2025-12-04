import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

// إلغاء حد حجم الرد (4MB) للسماح بإرسال ملفات كبيرة
export const config = {
  api: {
    responseLimit: false,
  },
};

export default async (req, res) => {
  const { pdfId, userId, deviceId } = req.query;

  if (!pdfId || !userId || !deviceId) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).json({ message: "Missing data" });
  }

  try {
    // =========================================================
    // الخطوة 1: جلب بيانات الملف من قاعدة البيانات مباشرة (في كل مرة)
    // =========================================================
    const { data } = await supabase
        .from('pdfs')
        .select('file_path, title')
        .eq('id', pdfId)
        .single();

    if (!data) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(404).json({ message: "Not found" });
    }

    const fullPath = path.join(process.cwd(), 'storage', 'pdfs', data.file_path);
    
    if (!fs.existsSync(fullPath)) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(404).json({ message: "File missing on server" });
    }

    const fileInfo = { filePath: fullPath, title: data.title };

    // =========================================================
    // الخطوة 2: التحقق الأمني
    // =========================================================
    const hasAccess = await checkUserAccess(userId, null, pdfId, null, deviceId);
    
    if (!hasAccess) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(403).json({ message: "Access Denied" });
    }

    // =========================================================
    // الخطوة 3: إرسال الملف (Streaming)
    // =========================================================
    const stat = fs.statSync(fileInfo.filePath);
    
    // إزالة الهيدرز التي تمنع الكاش
    res.removeHeader('Set-Cookie');
    res.removeHeader('Pragma');
    res.removeHeader('Expires');

    // إعدادات الكاش لـ Cloudflare والمتصفح لتقليل تكرار التحميل لنفس الطالب
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'max-age=31536000');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileInfo.title)}.pdf"`);

    const readStream = fs.createReadStream(fileInfo.filePath);
    readStream.pipe(res);

  } catch (err) {
    console.error("PDF API Error:", err);
    if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(500).json({ message: err.message });
    }
  }
};
