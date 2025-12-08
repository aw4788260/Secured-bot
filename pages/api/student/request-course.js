import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// إعدادات formidable لرفع الملفات
export const config = {
  api: { bodyParser: false },
};

export default async (req, res) => {
  // 1. التحقق من جلسة الطالب
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.student_session; // أو أي اسم تستخدمه لتوكن الطالب

  if (!sessionToken) return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });

  // جلب بيانات الطالب
  const { data: user } = await supabase.from('users').select('id, username, first_name, phone').eq('session_token', sessionToken).single();
  
  if (!user) return res.status(403).json({ error: 'مستخدم غير صالح' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 2. إعداد مجلد الحفظ
  const uploadDir = path.join(process.cwd(), 'storage', 'receipts');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = new formidable.IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'فشل رفع الملف' });

    try {
      // استخراج البيانات
      const courseId = fields.courseId ? fields.courseId[0] : null;
      const subjectId = fields.subjectId ? fields.subjectId[0] : null;
      const price = fields.price ? fields.price[0] : '0';
      const itemTitle = fields.itemTitle ? fields.itemTitle[0] : 'اشتراك';
      
      const receiptFile = files.receipt ? files.receipt[0] : null;
      if (!receiptFile) return res.status(400).json({ error: 'صورة الإيصال مطلوبة' });

      const fileName = path.basename(receiptFile.filepath);

      // 3. التحقق: هل يوجد طلب "معلق" لنفس الكورس؟ (لمنع التكرار)
      // (يمكنك تجاوز هذه الخطوة إذا كنت تريد السماح بطلبات متعددة)

      // 4. تجهيز هيكل البيانات (JSON) كما يتوقعه الأدمن
      const requestedData = [{
          id: courseId || subjectId,
          type: courseId ? 'course' : 'subject',
          title: itemTitle,
          price: price
      }];

      // 5. الحفظ في قاعدة البيانات
      const { error: dbError } = await supabase.from('subscription_requests').insert({
        user_id: user.id, // ربط الطلب بالطالب الموجود
        user_name: user.first_name,
        user_username: user.username,
        phone: user.phone,
        
        course_title: itemTitle, // للعرض السريع
        total_price: price,
        
        payment_method: 'vodafone_cash', // أو حسب اختيار الطالب
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
