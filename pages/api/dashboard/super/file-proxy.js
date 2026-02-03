import fs from 'fs';
import path from 'path';
import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';
import { checkUserAccess } from '../../../lib/authHelper'; // ✅ استيراد الحارس الأمني

export default async (req, res) => {
  const { type, filename } = req.query;

  let isAuthorized = false;

  // 1. المحاولة الأولى: التحقق عبر الكوكيز (للوحة تحكم الأدمن ويب)
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;

  if (sessionToken) {
      const { data: user } = await supabase
          .from('users')
          .select('is_admin')
          .eq('session_token', sessionToken)
          .single();
      
      if (user && user.is_admin) {
          isAuthorized = true;
      }
  }

  // 2. المحاولة الثانية: التحقق عبر التوكن (لتطبيق المعلم)
  if (!isAuthorized) {
      // نستخدم الحارس الأمني للتحقق من التوكن وبصمة الجهاز
      const hasAppAccess = await checkUserAccess(req);
      if (hasAppAccess) {
          isAuthorized = true;
      }
  }

  // إذا فشلت الطريقتين، نرفض الطلب
  if (!isAuthorized) {
      return res.status(403).send('Forbidden: Access Denied');
  }

  // 3. التحقق من المسار والملف
  const validTypes = ['receipts', 'pdfs', 'exam_images'];
  if (!validTypes.includes(type) || !filename) {
    return res.status(400).send('Invalid request');
  }

  const filePath = path.join(process.cwd(), 'storage', type, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // 4. إرسال الملف
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
  else if (ext === '.pdf') contentType = 'application/pdf';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
