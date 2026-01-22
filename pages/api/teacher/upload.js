import { verifyTeacher } from '../../../lib/teacherAuth';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// إعداد Multer لاستقبال الملفات في الذاكرة مؤقتاً
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export const config = {
  api: {
    bodyParser: false,
  },
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 1. التحقق من الصلاحية أولاً (قبل معالجة الملف لتوفير الموارد)
  // ملاحظة: الهيدرز متاحة دائماً حتى قبل معالجة الـ Body
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // 2. معالجة الملف
  await runMiddleware(req, res, upload.single('file'));

  if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const file = req.file;
    // تحديد الامتداد والمجلد المناسب بناءً على النوع
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = 'others';
    
    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        folder = 'exam_images'; // لتطابق file-proxy type=exam_images
    } else if (ext === '.pdf') {
        folder = 'pdfs';        // لتطابق file-proxy type=pdfs
    }

    // التأكد من وجود المجلد
    const uploadDir = path.join(process.cwd(), 'storage', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // إنشاء اسم فريد للملف
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // حفظ الملف محلياً
    fs.writeFileSync(filePath, file.buffer);

    console.log(`✅ File uploaded locally: ${folder}/${fileName}`);

    // إرجاع اسم الملف فقط (لأن file-proxy يحتاج الاسم والنوع، وليس رابطاً كاملاً)
    return res.status(200).json({ 
        success: true, 
        url: fileName, // التطبيق سيحفظ هذا الاسم لاستخدامه لاحقاً
        fileId: fileName
    });

  } catch (err) {
    console.error("Upload Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
