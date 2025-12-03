import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

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
    // 3. إعداد الكاش والتدفق
    const stat = fs.statSync(filePath);
    
    // ✅ تنظيف الهيدرز التي تمنع الكاش
    res.removeHeader('Set-Cookie'); // أهم سطر: حذف الكوكيز لمنع Cloudflare من رفض الكاش
    res.removeHeader('Pragma');     // حذف أي هيدر قديم يمنع الكاش
    res.removeHeader('Expires');    // الاعتماد فقط على Cache-Control

    // ✅ إعدادات الكاش القوية
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    
    // كاش للمتصفح (سنة)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); 
    
    // كاش لـ Cloudflare والـ CDNs (سنة)
    res.setHeader('Surrogate-Control', 'public, max-age=31536000'); 

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(data.title)}.pdf"`);

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
