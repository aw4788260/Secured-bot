// pages/api/secure/get-pdf.js
import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient'; // (تأكد أن هذا المسار صحيح)

// (دالة مساعدة لجلب رابط التحميل من تليجرام)
async function getTelegramDownloadUrl(lessonId) {
    const { data, error } = await supabase
        .from('videos')
        .select('storage_path, type')
        .eq('id', lessonId)
        .single();

    if (error || !data || data.type !== 'pdf' || !data.storage_path) {
        throw new Error('PDF not found or access denied');
    }
    
    const file_id = data.storage_path;
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) throw new Error('Server configuration error');

    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);
    if (!fileInfoResponse.data.ok) throw new Error('Failed to get file info from Telegram');

    const file_path = fileInfoResponse.data.result.file_path;
    return `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
}

export default async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) return res.status(400).json({ error: 'Missing lessonId' });

  try {
    const downloadUrl = await getTelegramDownloadUrl(lessonId);

    // --- [ ✅✅✅ بداية: الكود الجديد للبروكسي (Proxy) ] ---
    // (لن نستخدم 307 Redirect هنا)

    // 1. اطلب الملف من تليجرام كـ "stream"
    const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream' // (الأهم: اطلب الداتا كـ stream)
    });

    // 2. قم بإعداد الـ Headers للرد الخاص بك
    // (أخبر المتصفح أنه ملف PDF)
    res.setHeader('Content-Type', 'application/pdf');
    // (اختياري: يخبر المتصفح أن يعرضه "inline" بدلاً من تحميله)
    res.setHeader('Content-Disposition', `inline; filename="document.pdf"`);
    
    // 3. قم بـ "ضخ" (pipe) الداتا من رد تليجرام إلى رد Vercel
    // (هذا ينقل الملف للمستخدم بدون حفظه على السيرفر)
    response.data.pipe(res);
    // --- [ نهاية: الكود الجديد للبروكسي ] ---

  } catch (err) {
    console.error(`Error proxying PDF (lessonId: ${lessonId}):`, err.message);
    res.status(404).json({ error: 'File not found or proxy failed' });
  }
};
