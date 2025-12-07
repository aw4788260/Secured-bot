import fs from 'fs';
import path from 'path';
import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  const { type, filename } = req.query;

  // 1. التحقق الأمني: هل المتصفح يملك كوكيز الأدمن؟
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;

  if (!sessionToken) {
      return res.status(401).send('Unauthorized: No Session');
  }

  // التأكد من صحة التوكن في قاعدة البيانات
  const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('session_token', sessionToken)
      .single();

  if (error || !user || !user.is_admin) {
      return res.status(403).send('Forbidden: Admin Access Only');
  }

  // 2. التحقق من صحة الطلب
  const validTypes = ['receipts', 'pdfs', 'exam_images'];
  if (!validTypes.includes(type) || !filename) {
    return res.status(400).send('Invalid request');
  }

  // 3. تحديد المسار
  const filePath = path.join(process.cwd(), 'storage', type, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // 4. إرسال الملف (Stream)
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
  else if (ext === '.pdf') contentType = 'application/pdf';

  res.setHeader('Content-Type', contentType);
  // (اختياري) تفعيل الكاش لزيادة السرعة في المرات القادمة
  res.setHeader('Cache-Control', 'private, max-age=3600'); 
  
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
