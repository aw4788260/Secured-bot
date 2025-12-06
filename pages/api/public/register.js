import { supabase } from '../../../lib/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    return res.status(500).json({ error: 'فشل في إنشاء مجلد التخزين' });
  }

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filename: (name, ext, part) => `receipt_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });

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
    const password = getValue('password');
    const phone = getValue('phone');
    const selectedItemsStr = getValue('selectedItems');
    const receiptFile = getFile('receiptFile');

    if (!firstName || !username || !password || !phone || !receiptFile) {
        if (receiptFile) fs.unlinkSync(receiptFile.filepath);
        return res.status(400).json({ error: 'جميع البيانات مطلوبة' });
    }

    try {
        // التحقق من التكرار
        const { data: exist } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
        if (exist) {
             if (receiptFile) fs.unlinkSync(receiptFile.filepath);
             return res.status(400).json({ error: 'اسم المستخدم مسجل بالفعل' });
        }

        // --- [ التعديل الجديد يبدأ هنا ] ---
        let requestedData = [];
        let courseTitleText = "";
        let totalPrice = 0;

        try {
            // تحويل النص إلى مصفوفة
            requestedData = JSON.parse(selectedItemsStr || '[]');
            
            // 1. تجميع أسماء الكورسات في نص واحد (لحل مشكلة course_title)
            courseTitleText = requestedData.map(item => item.title).join(' + ');

            // 2. حساب السعر الإجمالي (لحل مشكلة total_price)
            totalPrice = requestedData.reduce((sum, item) => sum + (item.price || 0), 0);

        } catch (e) {
            console.error('Data Processing Error:', e);
            courseTitleText = "خطأ في قراءة البيانات";
        }

        const fileName = path.basename(receiptFile.filepath);

        // الحفظ في القاعدة مع الحقول الجديدة
        const { error: dbError } = await supabase.from('subscription_requests').insert({
            user_name: firstName,
            user_username: username,
            password_hash: password,
            phone: phone,
            requested_data: requestedData, 
            payment_file_path: fileName,
            status: 'pending',
            // ✅ تم إضافة الحقول الناقصة هنا
            course_title: courseTitleText, 
            total_price: totalPrice
        });
        // --- [ نهاية التعديل ] ---

        if (dbError) throw dbError;

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Register API Error:', error);
        return res.status(500).json({ error: error.message });
    }
  });
};
