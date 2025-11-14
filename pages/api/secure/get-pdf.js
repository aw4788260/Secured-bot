// pages/api/secure/get-pdf.js
import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient'; // (تأكد أن هذا المسار صحيح)

async function getTelegramDownloadUrl(lessonId) {
    // (جلب بيانات الملف من قاعدة البيانات)
    const { data, error } = await supabase.from('videos').select('storage_path, type').eq('id', lessonId).single();
    if (error || !data || data.type !== 'pdf' || !data.storage_path) {
        throw new Error('PDF not found or access denied (404)');
    }
    
    // (جلب رابط التحميل من تليجرام)
    const file_id = data.storage_path;
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) throw new Error('Server configuration error (500)');
    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);
    if (!fileInfoResponse.data.ok) throw new Error('Failed to get file info from Telegram (404)');
    const file_path = fileInfoResponse.data.result.file_path;
    return `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
}

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) return res.status(400).json({ error: 'Missing lessonId' });

  try {
    const downloadUrl = await getTelegramDownloadUrl(lessonId);

    // --- [ ✅✅ الكود الصحيح (تحميل الملف كاملاً ثم إرساله) ] ---
    
    // 1. اطلب الملف من تليجرام كـ "arraybuffer" (ملف كامل)
    // (إضافة تايم أوت 9 ثواني عشان نلحق نرد قبل Vercel)
    const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'arraybuffer', // (اطلب الملف كاملاً)
        timeout: 9000 // (9 ثواني)
    });

    // 2. حوله إلى Buffer (صيغة يفهمها السيرفر)
    const buffer = Buffer.from(response.data, 'binary');

    // 3. (الأهم) أرسل "حجم الملف" للمكتبة
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Type', 'application/pdf');
    
    // 4. أرسل الملف كاملاً
    res.send(buffer);
    
    // --- [ نهاية الكود الصحيح ] ---

  } catch (err) {
    console.error(`Error proxying PDF (lessonId: ${lessonId}):`, err.message);
    
    // (هذا هو الكود الذي يعالج خطأ الـ 10 ثواني)
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        res.status(504).send('Gateway Timeout: File took too long to load from Telegram.');
    } else {
        res.status(404).send(err.message || 'File not found or proxy failed');
    }
  }
};
