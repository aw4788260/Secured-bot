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
  // تسجيل الهيدرز للتتبع (اختياري)
  // console.log(`${apiName} 📥 Incoming Headers:`, JSON.stringify(req.headers));

  if (!pdfId) {
      return res.status(400).json({ message: "Missing pdfId" });
  }

  try {
    // 2. التحقق الأمني
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        res.setHeader('Cache-Control', 'no-store'); 
        return res.status(403).json({ message: "Access Denied" });
    }

    // 3. جلب مسار الملف من الداتا بيز
    const { data: pdfDoc, error } = await supabase
      .from('pdfs')
      .select('file_path, title')
      .eq('id', pdfId)
      .single();

    if (error || !pdfDoc) {
      return res.status(404).json({ message: "File info not found" });
    }

    // 4. تحديد المسار الفعلي
    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfDoc.file_path);

    if (!fs.existsSync(filePath)) {
      console.error(`${apiName} ❌ File missing on disk: ${filePath}`);
      return res.status(404).json({ message: "File content missing on server" });
    }

    // =================================================================
    // 5. ✅ منطق الـ Streaming الذكي (يدعم النفق X-Alt-Range)
    // =================================================================
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // 🔥 الحل الجذري: البحث عن Range العادي، أو البديل (X-Alt-Range) لتجاوز الحجب
    const range = req.headers.range || req.headers['x-alt-range'];

    const filename = encodeURIComponent(pdfDoc.title).replace(/['()]/g, escape);

    // إعدادات إجبارية لمنع الضغط ودعم التجزئة
    res.setHeader('Content-Encoding', 'identity'); 
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache'); // منع الكاش أثناء الاختبار

    if (range) {
      // ✅ حالة الـ Streaming (206 Partial Content)
      console.log(`${apiName} ✂️ Serving PARTIAL content via header: ${req.headers['x-alt-range'] ? 'X-Alt-Range' : 'Range'}`);
      
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
        'Content-Encoding': 'identity', // تكرار للتأكيد
      });

      const file = fs.createReadStream(filePath, { start, end });
      file.pipe(res);

    } else {
      // ❌ حالة التحميل الكامل (200 OK) - فقط إذا لم يصل أي هيدر
      console.log(`${apiName} ⚠️ Serving FULL content (No Range headers found)`);
      
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
