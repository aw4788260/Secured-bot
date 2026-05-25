import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

// إلغاء حدود حجم الاستجابة للسماح بالملفات الكبيرة
export const config = {
  api: { responseLimit: false },
};

export default async (req, res) => {
  const apiName = '[API: get-pdf]';
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { pdfId } = req.query;

  if (!pdfId) {
      return res.status(400).json({ message: "Missing pdfId" });
  }

  try {
    // 1. التحقق الأمني (Haras)
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied for PDF: ${pdfId}`);
        res.setHeader('Cache-Control', 'no-store'); 
        return res.status(403).json({ message: "Access Denied" });
    }

    // 2. جلب مسار الملف من الداتا بيز
    // ✅ [FIX F-13] جلب حقل content_hash من قاعدة البيانات
    const { data: pdfDoc, error } = await supabase
      .from('pdfs')
      .select('file_path, title, content_hash')
      .eq('id', pdfId)
      .single();

    if (error || !pdfDoc) {
      return res.status(404).json({ message: "File info not found" });
    }

    // 3. تحديد المسار الفعلي على السيرفر
    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfDoc.file_path);

    if (!fs.existsSync(filePath)) {
      console.error(`${apiName} ❌ File missing on disk: ${filePath}`);
      return res.status(404).json({ message: "File content missing on server" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const range = req.headers.range || req.headers['x-alt-range'];
    const filename = encodeURIComponent(pdfDoc.title).replace(/['()]/g, escape);

    // إعدادات إجبارية لمنع الضغط ودعم التجزئة
    res.setHeader('Content-Encoding', 'identity'); 
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache'); 

    // ✅ [FIX F-13] حقن بصمة الملف (SHA-256) في الهيدر لكي يقرأها التطبيق
    if (pdfDoc.content_hash) {
        res.setHeader('X-File-Hash', pdfDoc.content_hash);
    }

    if (range) {
      // حالة الـ Streaming (206 Partial Content)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
        'Content-Encoding': 'identity',
      });

      const file = fs.createReadStream(filePath, { start, end });
      file.pipe(res);

    } else {
      // حالة التحميل الكامل (200 OK)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'application/pdf',
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
        'Content-Encoding': 'identity',
      });

      const file = fs.createReadStream(filePath);
      file.pipe(res);
    }

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    if (!res.headersSent) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};
