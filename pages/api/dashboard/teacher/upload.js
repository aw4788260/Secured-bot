import { requireTeacherOrAdmin } from '../../../../lib/dashboardHelper';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false, responseLimit: false },
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = 'others';
    if (['.png', '.jpg', '.jpeg'].includes(ext)) folder = 'exam_images'; 
    else if (ext === '.pdf') folder = 'pdfs';

    const uploadDir = path.join(process.cwd(), 'storage', folder);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage, limits: { fileSize: 500 * 1024 * 1024 } });

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

  try {
    // 1. التحقق من الصلاحية (داشبورد)
    // ملاحظة: verifyDashboardSession يقرأ الكوكيز من الهيدر، لذا لا يحتاج لـ Body Parser
    const { user, error } = await requireTeacherOrAdmin(req, res);
    
    if (error) return; // الرد تم في الدالة المساعدة

    // 2. الرفع
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    return res.status(200).json({ 
        success: true, 
        url: req.file.filename,
        fileId: req.file.filename
    });

  } catch (err) {
    console.error("Dashboard Upload Error:", err);
    return res.status(500).json({ error: `Upload Failed: ${err.message}` });
  }
};
