import fs from 'fs';
import path from 'path';
import { supabase } from '../../../lib/supabaseClient';
import { parse } from 'cookie';

export default async (req, res) => {
  const { type, filename } = req.query;

  // 1. الحماية: التأكد من أن الطالب هو "أدمن" عبر الكوكيز
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;

  if (!sessionToken) {
      return res.status(401).send('Unauthorized');
  }

  // (اختياري: للسرعة القصوى يمكن تخطي فحص الداتابيز والاكتفاء بوجود الكوكي، 
  // ولكن للأمان سنبقيه، الكاش سيتولى السرعة في المرات القادمة)
  const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('session_token', sessionToken)
      .single();

  if (error || !user || !user.is_admin) {
      return res.status(403).send('Forbidden');
  }

  // 2. التحقق من المسار
  const validTypes = ['receipts', 'pdfs', 'exam_images'];
  if (!validTypes.includes(type) || !filename) {
    return res.status(400).send('Invalid request');
  }

  const filePath = path.join(process.cwd(), 'storage', type, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // 3. إعداد الكاش والنوع
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
  else if (ext === '.pdf') contentType = 'application/pdf';

  res.setHeader('Content-Type', contentType);
  
  // 🔥 سر السرعة: تخزين الصورة في متصفح الأدمن لمدة سنة
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
