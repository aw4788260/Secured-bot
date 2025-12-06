import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { responseLimit: false },
};

export default async (req, res) => {
  const apiName = '[API: get-pdf]';
  console.log(`${apiName} 🚀 Request started.`);

  const { pdfId } = req.query;
  const userId = req.headers['x-user-id'];

  if (!pdfId) {
      console.warn(`${apiName} ❌ Missing pdfId.`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).json({ message: "Missing pdfId" });
  }

  console.log(`${apiName} 👤 User: ${userId} requesting PDF: ${pdfId}`);

  try {
    // 1. التحقق الأمني
    console.log(`${apiName} 🔒 Checking permissions...`);
    const hasAccess = await checkUserAccess(req, pdfId, 'pdf');
    
    if (!hasAccess) {
        console.warn(`${apiName} ⛔ Access Denied.`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(403).json({ message: "Access Denied" });
    }
    console.log(`${apiName} ✅ Access Granted.`);

    // 2. جلب المسار
    const { data } = await supabase.from('pdfs').select('file_path, title').eq('id', pdfId).single();
    if (!data) {
        console.error(`${apiName} ❌ PDF record not found in DB.`);
        return res.status(404).json({ message: "Not found" });
    }

    const fullPath = path.join(process.cwd(), 'storage', 'pdfs', data.file_path);
    if (!fs.existsSync(fullPath)) {
        console.error(`${apiName} ❌ File missing on disk: ${fullPath}`);
        return res.status(404).json({ message: "File missing on server" });
    }

    console.log(`${apiName} 📄 Streaming file: ${data.title}`);

    // 3. إرسال الملف
    const stat = fs.statSync(fullPath);
    res.setHeader('Cache-Control', 'private, max-age=3600'); 
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(data.title)}.pdf"`);

    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);
    
    readStream.on('end', () => console.log(`${apiName} ✅ Stream finished.`));
    readStream.on('error', (e) => console.error(`${apiName} 🔥 Stream error:`, e));

  } catch (err) {
    console.error(`${apiName} 🔥 ERROR:`, err.message);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};
