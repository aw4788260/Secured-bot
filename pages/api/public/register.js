import { supabase } from '../../../lib/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs'; // [جديد] مكتبة التشفير

export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التأكد من وجود مجلد الحفظ
  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'فشل في إنشاء مجلد التخزين' });
  }

  // 2. إعداد مكتبة الرفع
  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filename: (name, ext, part) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `receipt_${uniqueSuffix}${ext}`;
    }
  });

  // 3. معالجة الطلب
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
    }

    const getValue = (key) => {
        const val = fields[key];
        return Array.isArray(val) ? val[0] : val;
    };
    
    const getFile = (key) => {
        const file = files[key];
        return Array.isArray(file) ? file[0] : file;
    };

    const firstName = getValue('firstName');
    const username = getValue('username');
    const password = getValue('password'); // كلمة المرور الأصلية
    const phone = getValue('phone');
    const selectedItemsStr = getValue('selectedItems');
    const receiptFile = getFile('receiptFile');

    // التحقق من وجود البيانات
    if (!firstName || !username || !password || !phone || !receiptFile) {
        if (receiptFile && fs.existsSync(receiptFile.filepath)) fs.unlinkSync(receiptFile.filepath);
        return res.status(400).json({ error: 'جميع البيانات مطلوبة بما فيها الإيصال' });
    }

    // [جديد] ✅ التحقق من طول كلمة المرور (6 أحرف على الأقل)
    if (password.length < 6) {
        if (receiptFile && fs.existsSync(receiptFile.filepath)) fs.unlinkSync(receiptFile.filepath);
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    try {
        // التحقق من تكرار المستخدم
        const { data: exist } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
        if (exist) {
             if (receiptFile && fs.existsSync(receiptFile.filepath)) fs.unlinkSync(receiptFile.filepath);
             return res.status(400).json({ error: 'اسم المستخدم مسجل بالفعل' });
        }

        // معالجة بيانات الكورس والسعر
        let requestedData = [];
        let courseTitleText = "";
        let totalPrice = 0;

        try {
            requestedData = JSON.parse(selectedItemsStr || '[]');
            courseTitleText = requestedData.map(item => item.title).join(' + ');
            totalPrice = requestedData.reduce((sum, item) => sum + (item.price || 0), 0);
        } catch (e) {
            courseTitleText = "خطأ في قراءة البيانات";
        }

        const fileName = path.basename(receiptFile.filepath);

        // [جديد] ✅ تشفير كلمة المرور قبل الحفظ
        const hashedPassword = await bcrypt.hash(password, 10);

        // الحفظ في القاعدة (لاحظ نستخدم hashedPassword)
        const { error: dbError } = await supabase.from('subscription_requests').insert({
            user_name: firstName,
            user_username: username,
            password_hash: hashedPassword, // يتم حفظ التشفير هنا
            phone: phone,
            requested_data: requestedData,
            payment_file_path: fileName,
            status: 'pending',
            course_title: courseTitleText, 
            total_price: totalPrice
        });

        if (dbError) throw dbError;

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Register API Error:', error);
        return res.status(500).json({ error: error.message });
    }
  });
};
