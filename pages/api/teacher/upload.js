import { supabase } from '../../../lib/supabaseClient';
import { verifyTeacher } from '../../../lib/teacherAuth';
import multer from 'multer';
import { decode } from 'base64-arraybuffer'; // قد تحتاجها إذا كنت ترفع base64 مباشرة من فلاتر

// إعداد Multer لاستقبال الملفات في الذاكرة
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// إعداد Next.js لعدم معالجة الـ Body تلقائياً (لأن Multer سيتولى ذلك)
export const config = {
  api: {
    bodyParser: false,
  },
};

// دالة مساعدة لتشغيل الـ Middleware
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

  // 1. معالجة الملف المرفوع
  await runMiddleware(req, res, upload.single('file'));

  // 2. التحقق من الصلاحية (بعد معالجة الـ Multipart)
  // ملاحظة: verifyTeacher يتوقع req عادي، لكن مع multer قد نحتاج استخراج الهيدر يدوياً
  // أو الاعتماد على التوكن في الهيدر مباشرة
  const auth = await verifyTeacher(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    // مسار التخزين: teachers/{teacherId}/{fileName}
    const filePath = `teachers/${auth.teacherId}/${fileName}`;

    // رفع الملف إلى Supabase Storage (Bucket: 'public-assets' أو حسب إعداداتك)
    const { data, error } = await supabase
      .storage
      .from('public-assets') // تأكد أن هذا الـ Bucket موجود وعام
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // جلب الرابط العام
    const { data: { publicUrl } } = supabase
      .storage
      .from('public-assets')
      .getPublicUrl(filePath);

    return res.status(200).json({ 
        success: true, 
        url: publicUrl, 
        fileId: filePath // نحتفظ بالمسار للحذف لاحقاً إذا احتجنا
    });

  } catch (err) {
    console.error("Upload Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
