import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // 1. استيراد الحارس
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 2. التحقق الأمني قبل معالجة أي شيء
  const isAuthorized = await checkUserAccess(req);
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }

  // 3. استخدام المعرف الآمن
  const userId = req.headers['x-user-id'];

  // جلب بيانات المستخدم لتسجيلها في الطلب
  const { data: user } = await supabase
      .from('users')
      .select('id, username, first_name, phone')
      .eq('id', userId)
      .single();

  if (!user) {
      return res.status(404).json({ error: 'User data not found' });
  }

  // 4. إعداد مجلد الحفظ
  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'فشل في إنشاء مجلد التخزين' });
  }

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filename: (name, ext, part) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `receipt_${uniqueSuffix}${ext}`;
    }
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
        console.error("Formidable Error:", err);
        return res.status(500).json({ error: 'فشل معالجة الملف المرفوع' });
    }

    try {
      const getValue = (key) => {
          const val = fields[key];
          return Array.isArray(val) ? val[0] : val;
      };
      
      const getFile = (key) => {
          const file = files[key];
          return Array.isArray(file) ? file[0] : file;
      };

      // استقبال البيانات
      const selectedItemsStr = getValue('selectedItems');
      const userNote = getValue('user_note');
      const receiptFile = getFile('receiptFile');
      
      if (!selectedItemsStr) return res.status(400).json({ error: 'لا توجد عناصر مختارة' });
      if (!receiptFile) return res.status(400).json({ error: 'صورة الإيصال مطلوبة' });

      const selectedItems = JSON.parse(selectedItemsStr);
      if (selectedItems.length === 0) return res.status(400).json({ error: 'السلة فارغة' });

      const fileName = path.basename(receiptFile.filepath);

      // حساب الإجمالي وتجهيز العنوان
      let totalPrice = 0;
      let titleList = [];
      const requestedData = [];

      selectedItems.forEach(item => {
          const price = parseInt(item.price) || 0;
          totalPrice += price;
          
          const typeLabel = item.type === 'course' ? '📦 كورس' : '📄 مادة';
          titleList.push(`${typeLabel}: ${item.title}`);
          
          requestedData.push({
              id: item.id,
              type: item.type,
              title: item.title,
              price: price
          });
      });

      // تنسيق العنوان النهائي
      let finalTitle = titleList.join('\n');
      
      if (userNote && userNote.trim() !== '') {
          finalTitle += `\n\n📝 ملاحظة الطالب:\n${userNote}`;
      }

      // الحفظ في القاعدة باستخدام بيانات المستخدم التي جلبناها بالأعلى
      const { error: dbError } = await supabase.from('subscription_requests').insert({
        user_id: user.id,
        user_name: user.first_name,
        user_username: user.username,
        phone: user.phone,
        
        course_title: finalTitle,
        total_price: totalPrice,
        
        payment_file_path: fileName,
        status: 'pending',
        requested_data: requestedData
      });

      if (dbError) throw dbError;

      return res.status(200).json({ success: true, message: 'تم إرسال طلب الاشتراك بنجاح! سيتم مراجعته.' });

    } catch (error) {
      console.error("Server Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
};
