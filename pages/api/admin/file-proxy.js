import fs from 'fs';
import path from 'path';

export default async (req, res) => {
  // ملاحظة: في النسخة النهائية سنضيف هنا التحقق من التوكن (checkUserAccess)
  // لكن الآن نتركه مفتوحاً قليلاً لكي تعمل صفحة التسجيل والأدمن بسلاسة في البداية
  
  const { type, filename } = req.query; 

  // أنواع المجلدات المسموح الوصول إليها فقط
  const validTypes = ['receipts', 'pdfs', 'exam_images'];
  
  if (!validTypes.includes(type) || !filename) {
    return res.status(400).send('Invalid request');
  }

  // تحديد المسار الآمن
  const filePath = path.join(process.cwd(), 'storage', type, filename);

  // التأكد من وجود الملف
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // تحديد نوع المحتوى (Content-Type)
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
  else if (ext === '.pdf') contentType = 'application/pdf';

  // إرسال الملف
  res.setHeader('Content-Type', contentType);
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
