import { supabase } from '../../../lib/supabaseClient'; // تأكد من مسار الاستيراد الصحيح
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// إعدادات Next.js لتعطيل الـ Body Parser الافتراضي (ضروري لرفع الملفات)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // إعداد مجلد الرفع
  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10 ميجا حد أقصى
    filename: (name, ext, part) => {
      // تسمية الملف باسم فريد (التوقيت + اسم عشوائي)
      return `receipt_${Date.now()}_${path.basename(part.originalFilename).replace(/\s/g, '_')}`;
    }
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Upload Error:", err);
      return res.status(500).json({ error: 'فشل رفع الملف' });
    }

    // استخراج البيانات (formidable v3 يعيد القيم كمصفوفات)
    const getField = (key) => Array.isArray(fields[key]) ? fields[key][0] : fields[key];
    const getFile = (key) => Array.isArray(files[key]) ? files[key][0] : files[key];

    const firstName = getField('firstName');
    const username = getField('username');
    const password = getField('password');
    const phone = getField('phone');
    const selectedCoursesStr = getField('selectedCourses'); // تأتي كـ String JSON
    const uploadedFile = getFile('receiptFile');

    // التحقق من البيانات
    if (!firstName || !username || !password || !uploadedFile) {
        // حذف الملف إذا كانت البيانات ناقصة لتوفير المساحة
        if(uploadedFile) fs.unlinkSync(uploadedFile.filepath);
        return res.status(400).json({ error: 'جميع الحقول مطلوبة بما فيها الإيصال' });
    }

    try {
        // التحقق من تكرار اسم المستخدم
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();
            
        if (existingUser) {
            fs.unlinkSync(uploadedFile.filepath);
            return res.status(400).json({ error: 'اسم المستخدم (Username) مستخدم بالفعل، اختر اسماً آخر.' });
        }

        // تحضير قائمة الكورسات
        let requestedData = [];
        try {
            const courseIds = JSON.parse(selectedCoursesStr || '[]');
            requestedData = courseIds.map(id => ({ type: 'course', id: parseInt(id) }));
        } catch (e) {
            console.error("JSON Parse Error:", e);
        }

        const fileName = path.basename(uploadedFile.filepath);

        // إدخال الطلب في قاعدة البيانات
        const { error: dbError } = await supabase.from('subscription_requests').insert({
            user_name: firstName,
            user_username: username,
            password_hash: password, // في بيئة حقيقية يفضل التشفير، هنا سنحفظها كما هي للتسهيل حالياً
            phone: phone,
            requested_data: requestedData,
            payment_file_path: fileName,
            status: 'pending'
        });

        if (dbError) throw dbError;

        return res.status(200).json({ success: true, message: 'تم إرسال طلبك بنجاح' });

    } catch (error) {
        console.error("DB Error:", error);
        return res.status(500).json({ error: error.message });
    }
  });
};
