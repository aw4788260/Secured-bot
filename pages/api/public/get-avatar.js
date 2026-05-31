import fs from 'fs';
import path from 'path';

export default async (req, res) => {
  const { file } = req.query;

  if (!file) {
    return res.status(400).json({ error: 'File name is required' });
  }

  // ✅ استخدام process.cwd() لضمان الوصول للمسار الصحيح ديناميكياً
  // هذا يضمن أن المسار هو: /www/wwwroot/secured-bot-prod/storage/avatars
  const storagePath = path.join(process.cwd(), 'storage', 'avatars');
  
  // حماية من محاولات الوصول لملفات النظام (Directory Traversal)
  const safeFileName = path.basename(file);
  const filePath = path.join(storagePath, safeFileName);

  // التأكد من وجود الملف
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // تحديد نوع المحتوى تلقائياً
  const ext = path.extname(safeFileName).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  if (ext === '.webp') contentType = 'image/webp';
  if (ext === '.gif') contentType = 'image/gif';

  // ✅ إرسال الهيدرز المناسبة
  res.setHeader('Content-Type', contentType);
  // كاش لمدة سنة للسرعة (لأن اسم الملف يتغير مع كل تحديث للصورة فلا داعي للخوف من الكاش القديم)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); 

  // ✅ قراءة الملف وإرساله كـ Stream
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
