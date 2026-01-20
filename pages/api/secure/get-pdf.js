import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { responseLimit: false },
};

export default async (req, res) => {
  const apiName = '[API: get-pdf]';
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { pdfId } = req.query;
  const userId = req.headers['x-user-id'];

  // 🔍 تسجيل الهيدرز القادمة لمعرفة هل Range يصل أم لا
  // ابحث عن هذا السطر في اللوجات بعد التشغيل
  console.log(`${apiName} 📥 Incoming Headers for PDF ${pdfId}:`, JSON.stringify(req.headers));

  if (!pdfId) return res.status(400).json({ message: "Missing pdfId" });

  try {
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    if (!hasAccess) {
        res.setHeader('Cache-Control', 'no-store'); 
        return res.status(403).json({ message: "Access Denied" });
    }

    const { data: pdfDoc, error } = await supabase
      .from('pdfs')
      .select('file_path, title')
      .eq('id', pdfId)
      .single();

    if (error || !pdfDoc) return res.status(404).json({ message: "File info not found" });

    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfDoc.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File content missing on server" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // ✅ تصحيح: محاولة قراءة Range بكل الطرق الممكنة (صغير وكبير)
    const range = req.headers.range || req.headers.Range;

    const filename = encodeURIComponent(pdfDoc.title).replace(/['()]/g, escape);

    // إعدادات منع الضغط ودعم التجزئة (مهمة جداً)
    res.setHeader('Content-Encoding', 'identity'); 
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    if (range) {
      // ✅ حالة الـ Streaming (206)
      console.log(`${apiName} ✂️ Serving PARTIAL content: ${range}`);
      
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
      // ❌ حالة التحميل الكامل (200) - يحدث إذا لم يصل Range
      console.log(`${apiName} ⚠️ Serving FULL content (No Range Header found)`);
      
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
    if (!res.headersSent) res.status(500).json({ message: 'Internal Server Error' });
  }
};
