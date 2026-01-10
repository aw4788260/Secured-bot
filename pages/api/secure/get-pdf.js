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
  
  // 1. التحقق من نوع الطلب
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { pdfId } = req.query;
  const userId = req.headers['x-user-id'];

  // التحقق المبدئي
  if (!pdfId) {
      console.warn(`${apiName} ❌ Missing pdfId.`);
      return res.status(400).json({ message: "Missing pdfId" });
  }

  console.log(`${apiName} 🚀 Request started by User: ${userId} for PDF: ${pdfId}`);

  try {
    // 2. التحقق الأمني (هل يملك الطالب هذا الملف؟)
    // نستخدم checkUserAccess التي قمت بضبطها مسبقاً في authHelper
    console.log(`${apiName} 🔒 Checking permissions...`);
    
    // نمرر الـ req بالكامل ليتمكن authHelper من قراءة الهيدرز (x-user-id, x-device-id, x-app-secret)
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        // منع التخزين المؤقت لردود الرفض
        res.setHeader('Cache-Control', 'no-store'); 
        return res.status(403).json({ message: "Access Denied" });
    }
    console.log(`${apiName} ✅ Access Granted.`);

    // 3. جلب بيانات الملف من قاعدة البيانات لمعرفة اسم الملف المخزن
    const { data: pdfDoc, error } = await supabase
      .from('pdfs')
      .select('file_path, title')
      .eq('id', pdfId)
      .single();

    if (error || !pdfDoc) {
      console.error(`${apiName} ❌ PDF record not found in DB.`);
      return res.status(404).json({ message: "File info not found" });
    }

    // 4. تحديد المسار الفعلي على الخادم
    // التخزين يتم في المجلد الجذري للمشروع داخل /storage/pdfs
    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfDoc.file_path);

    // التحقق من وجود الملف فعلياً
    if (!fs.existsSync(filePath)) {
      console.error(`${apiName} ❌ File missing on disk: ${filePath}`);
      return res.status(404).json({ message: "File content missing on server" });
    }

    // 5. إعداد الهيدرز وإرسال الملف (Streaming)
    const stat = fs.statSync(filePath);
    
    // إعدادات الكاش والتنزيل
    res.setHeader('Cache-Control', 'private, max-age=3600'); // تخزين لمدة ساعة في جهاز المستخدم فقط
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    // encodeURIComponent مهم لدعم الأسماء العربية
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdfDoc.title)}.pdf"`);

    console.log(`${apiName} 📄 Streaming file: ${pdfDoc.title} (${stat.size} bytes)`);

    // إنشاء تيار قراءة وإرساله للعميل
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    
    // التعامل مع أحداث التيار (اختياري للوجات)
    readStream.on('error', (streamErr) => {
        console.error(`${apiName} 🔥 Stream error:`, streamErr);
        if (!res.headersSent) res.status(500).json({ message: "Streaming failed" });
    });

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    if (!res.headersSent) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};
