import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

export default async (req, res) => {
  // استقبال البيانات من الرابط
  const { pdfId, userId, deviceId } = req.query;

  if (!pdfId || !userId || !deviceId) {
      return res.status(400).json({ message: "Missing data" });
  }

  try {
    // 1. التحقق من الصلاحية (الداتا بيز + البصمة)
    const hasAccess = await checkUserAccess(userId, null, pdfId, null, deviceId);
    if (!hasAccess) return res.status(403).json({ message: "Access Denied by DB" });

    // 2. جلب مسار الملف
    const { data: pdfData } = await supabase.from('pdfs').select('file_path, title').eq('id', pdfId).single();
    if (!pdfData) return res.status(404).json({ message: "PDF Not found" });

    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfData.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File missing on disk" });

    // 3. إعداد الهيدرز (منع الكاش لضمان الأمان الأقصى)
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    
    // منع الكاش لإجبار المتصفح على المرور بالـ Middleware في كل مرة
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdfData.title)}.pdf"`);

    // 4. إرسال الملف
    fs.createReadStream(filePath).pipe(res);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
