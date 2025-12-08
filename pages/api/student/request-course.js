import { supabase } from '../../../lib/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. التحقق من المستخدم (عبر الهيدر فقط)
  let user = null;
  const headerUserId = req.headers['x-user-id'];

  if (headerUserId) {
      // جلب بيانات المستخدم من القاعدة للتأكد أنه موجود
      const { data } = await supabase.from('users').select('id, username, first_name, phone').eq('id', headerUserId).single();
      user = data;
  }

  // إذا لم نجد مستخدم بهذا الآيدي -> رفض الطلب
  if (!user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً (فشل التحقق من الهوية)' });
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

  const form = new formidable.IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'فشل رفع الملف' });

    try {
      const courseId = fields.courseId ? fields.courseId[0] : null;
      const subjectId = fields.subjectId ? fields.subjectId[0] : null;
      const price = fields.price ? fields.price[0] : '0';
      const itemTitle = fields.itemTitle ? fields.itemTitle[0] : 'اشتراك';
      
      const receiptFile = files.receipt ? files.receipt[0] : null;
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
        course_title: itemTitle,
        total_price: price,
        payment_method: 'vodafone_cash',
        payment_file_path: fileName,
        status: 'pending',
        requested_data: requestedData
      });

      if (dbError) throw dbError;

      return res.status(200).json({ success: true, message: 'تم إرسال طلب الاشتراك بنجاح! سيتم تفعيله قريباً.' });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  });
};
