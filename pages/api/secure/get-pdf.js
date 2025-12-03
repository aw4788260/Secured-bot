import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

export default async (req, res) => {
  // 1. قراءة البيانات (ندعم الطريقتين: من الرابط أو من الهيدر)
  const pdfId = req.query.pdfId;
  const userId = req.headers['x-user-id'] || req.query.userId;
  const deviceId = req.headers['x-device-id'] || req.query.deviceId;

  if (!pdfId || !userId || !deviceId) {
      return res.status(400).json({ message: "Missing auth data" });
  }

  try {
    // 2. التحقق الأمني
    const hasAccess = await checkUserAccess(userId, null, pdfId, null, deviceId);
    if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

    // 3. جلب معلومات الملف
    const { data: pdfData } = await supabase.from('pdfs').select('file_path, title').eq('id', pdfId).single();
    if (!pdfData) return res.status(404).json({ message: "Not found" });

    const filePath = path.join(process.cwd(), 'storage', 'pdfs', pdfData.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File missing on disk" });

    // 4. إعداد الكاش (هنا السر: الرابط أصبح موحداً فالكاش سيعمل للجميع)
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdfData.title)}.pdf"`);

    fs.createReadStream(filePath).pipe(res);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
