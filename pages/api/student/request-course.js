import { supabase } from '../../../lib/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من الهوية (عبر الهيدر)
  let user = null;
  const headerUserId = req.headers['x-user-id'];

  if (headerUserId) {
      const { data } = await supabase.from('users').select('id, username, first_name, phone').eq('id', headerUserId).single();
      user = data;
  }

  if (!user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
  }

  // 2. إعداد مجلد الحفظ
  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'فشل في إنشاء مجلد التخزين' });
  }

  const form = formidable({
    uploadDir: uploadDir,
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

      const courseId = getValue('courseId');
      const subjectId = getValue('subjectId');
      const price = getValue('price') || '0';
      let itemTitle = getValue('itemTitle') || 'اشتراك';
      const userNote = getValue('user_note'); // [✅] قراءة الملاحظة

      // [✅] دمج الملاحظة مع العنوان لتظهر في لوحة الأدمن
      if (userNote && userNote.trim() !== '') {
          itemTitle += `\n\n📝 ملاحظة الطالب: ${userNote}`;
      }
      
      const receiptFile = getFile('receiptFile');
      if (!receiptFile) return res.status(400).json({ error: 'صورة الإيصال مطلوبة' });

      const fileName = path.basename(receiptFile.filepath);

      const requestedData = [{
          id: courseId || subjectId,
          type: courseId ? 'course' : 'subject',
          title: itemTitle,
          price: price
      }];

      const { error: dbError } = await supabase.from('subscription_requests').insert({
        user_id: user.id,
        user_name: user.first_name,
        user_username: user.username,
        phone: user.phone,
        
        course_title: itemTitle, // العنوان يحتوي الآن على الملاحظة
        total_price: parseInt(price) || 0,
        
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
