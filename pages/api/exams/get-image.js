// pages/api/exams/get-image.js
import axios from 'axios';

/**
 * هذا الـ API يعمل كبروكسي آمن وموفر للباقة.
 * بدلاً من تحميل الصورة على Vercel ثم إرسالها للمستخدم (استهلاك مزدوج للباقة)،
 * نقوم بطلب "رابط تحميل مؤقت" من تليجرام، ثم نقوم بعمل "إعادة توجيه" (Redirect) للمستخدم.
 * هذا يجعل جهاز المستخدم يقوم بتحميل الصورة مباشرة من خوادم تليجرام.
 */
export default async (req, res) => {
  const { file_id } = req.query;

  if (!file_id) {
    return res.status(400).json({ error: 'Missing file_id' });
  }

  // 1. جلب التوكن بأمان
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is not set!");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 2. طلب "مسار" الملف من تليجرام
    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);

    if (!fileInfoResponse.data.ok) {
      throw new Error(fileInfoResponse.data.description || 'Failed to get file info from Telegram');
    }

    const file_path = fileInfoResponse.data.result.file_path;

    // 3. بناء رابط التحميل المباشر
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;

    // 4. [ ✅ الأهم ] إرسال "إعادة توجيه مؤقت" (307)
    // هذا يخبر متصفح المستخدم: "اذهب وجلب الصورة من هذا الرابط"
    res.redirect(307, downloadUrl);

  } catch (err) {
    console.error(`Error proxying Telegram image (file_id: ${file_id}):`, err.message);
    res.status(404).json({ error: 'Image not found or proxy failed' });
  }
};
