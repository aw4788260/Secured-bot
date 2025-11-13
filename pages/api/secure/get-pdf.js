// pages/api/secure/get-pdf.js
import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient';

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) return res.status(400).json({ error: 'Missing lessonId' });

  try {
    // 1. جلب بيانات الملف
    const { data, error } = await supabase
      .from('videos')
      .select('storage_path, type')
      .eq('id', lessonId)
      .single();

    // (نتأكد أنه PDF)
    if (error || !data || data.type !== 'pdf' || !data.storage_path) {
      throw new Error('PDF not found or access denied');
    }
    
    const file_id = data.storage_path;
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) throw new Error('Server configuration error');

    // 2. طلب مسار الملف من تليجرام
    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);
    if (!fileInfoResponse.data.ok) throw new Error('Failed to get file info from Telegram');

    const file_path = fileInfoResponse.data.result.file_path;
    
    // 3. بناء رابط التحميل المباشر
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;

    // 4. [ ✅✅ هذا هو التعديل: إعادة التوجيه 307 ]
    // (تماماً مثل الفيديو، نجبر المتصفح/البرنامج على الذهاب لجلب الملف)
    res.redirect(307, downloadUrl);

  } catch (err) {
    console.error(`Error redirecting to PDF (lessonId: ${lessonId}):`, err.message);
    res.status(404).json({ error: 'File not found or redirect failed' });
  }
};
