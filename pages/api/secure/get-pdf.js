import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

// إلغاء حدود حجم الاستجابة
export const config = {
  api: { responseLimit: false },
};

export default async (req, res) => {
  const apiName = '[API: get-pdf]';
  
  // 1. التحقق من نوع الطلب
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { pdfId } = req.query;
  const userId = req.headers['x-user-id'];

  if (!pdfId) {
      // console.warn(`${apiName} ❌ Missing pdfId.`);
      return res.status(400).json({ message: "Missing pdfId" });
  }

  // console.log(`${apiName} 🚀 Request by User: ${userId} -> PDF: ${pdfId}`);

  try {
    // 2. التحقق الأمني
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        res.setHeader('Cache-Control', 'no-store'); 
        return res.status(403).json({ message: "Access Denied" });
    }

    // 3. جلب بيانات الملف
    const { data: pdfDoc, error } = await supabase
      .from('pdfs')
      .select('file_path, title')
      .eq('id', pdfId)
      .single();

    if (error || !pdfDoc) {
      return res.status(404).json({ message: "File info not found" });
    }

    // 4. تحديد المسار
    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfDoc.file_path);

    if (!fs.existsSync(filePath)) {
      console.error(`${apiName} ❌ File missing: ${filePath}`);
      return res.status(404).json({ message: "File content missing on server" });
    }

    // =================================================================
    // 5. ✅ التعديل الجذري: دعم الـ Streaming و Range Requests
    // =================================================================
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range; // 👈 هل طلب التطبيق جزءاً محدداً؟

    // إعداد اسم الملف للتحميل
    const filename = encodeURIComponent(pdfDoc.title).replace(/['()]/g, escape);

    if (range) {
      // 🅰️ حالة طلب جزئي (Seeking / Streaming)
      // الصيغة تأتي عادة: bytes=0-1023
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      const chunksize = (end - start) + 1;
      
      // إرسال كود 206 (Partial Content)
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      });

      // قراءة الجزء المطلوب فقط من القرص وإرساله
      const file = fs.createReadStream(filePath, { start, end });
      file.pipe(res);

    } else {
      // 🅱️ حالة طلب الملف كاملاً (أول طلب أو تحميل عادي)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'application/pdf',
        'Accept-Ranges': 'bytes', // 👈 نخبر التطبيق أننا ندعم التجزئة للمرة القادمة
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
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
