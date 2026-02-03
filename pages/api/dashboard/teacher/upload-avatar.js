import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// إعداد Multer باستخدام الذاكرة (نفس منطق api user upload avatar)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 30 * 1024 * 1024 } // حد أقصى 5 ميجا للصورة
});

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

  // 1. التحقق من الصلاحية (استخدام حماية الداشبورد بدلاً من حماية التطبيق)
  const { user, error } = await requireTeacherOrAdmin(req, res);
  if (error) {
      // الرد بالخطأ تم إرساله مسبقاً
      return; 
  }

  // 2. معالجة الملف
  await runMiddleware(req, res, upload.single('file'));

  if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    
    // التأكد من الامتداد
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        return res.status(400).json({ error: 'Only images are allowed' });
    }

    // تحديد المجلد (storage/avatars) ليتوافق مع باقي النظام
    const uploadDir = path.join(process.cwd(), 'storage', 'avatars');
    
    // إنشاء المجلد إذا لم يكن موجوداً
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // إنشاء اسم فريد
    const fileName = `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // حفظ الملف
    fs.writeFileSync(filePath, file.buffer);

    console.log(`✅ Dashboard Avatar uploaded: ${fileName}`);

    // إرجاع اسم الملف فقط ليتم استخدامه في تحديث البروفايل
    return res.status(200).json({ 
        success: true, 
        url: fileName, 
        fileId: fileName
    });

  } catch (err) {
    console.error("Dashboard Avatar Upload Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
