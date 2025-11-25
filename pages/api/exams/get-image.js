// pages/api/exams/get-image.js
import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper';

export default async (req, res) => {
  // 1. استقبال البيانات اللازمة للتحقق
  const { file_id, userId, deviceId } = req.query;

  if (!file_id || !userId || !deviceId) {
    return res.status(400).json({ error: 'Missing file_id, userId, or deviceId' });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'Server config error' });

  try {
    // 2. البحث عن الامتحان المرتبط بهذه الصورة (لأن الصلاحية مرتبطة بالامتحان)
    const { data: questionData, error: qError } = await supabase
        .from('questions')
        .select('exam_id')
        .eq('image_file_id', file_id)
        .maybeSingle();

    if (qError || !questionData) {
        return res.status(404).json({ error: 'Image not found in database' });
    }

    // 3. [🔒 الحماية القصوى] التحقق من المستخدم + الجهاز + الاشتراك
    const hasAccess = await checkUserAccess(userId, null, null, questionData.exam_id, deviceId);
    
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access Denied: Device Mismatch or No Subscription.' });
    }

    // 4. جلب مسار الملف من تليجرام (Server-to-Server)
    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfo = await axios.get(getFileUrl);
    
    if (!fileInfo.data.ok) throw new Error('Telegram API Error');
    
    const filePath = fileInfo.data.result.file_path;
    const telegramUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

    // 5. [🛡️ البروكسي] جلب الصورة كـ Stream
    const imageResponse = await axios({
        method: 'GET',
        url: telegramUrl,
        responseType: 'stream'
    });

    // 6. إعداد الهيدرز (كاش لمدة سنة لتوفير الباقة + نوع الملف)
    res.setHeader('Content-Type', 'image/jpeg'); 
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // 7. إرسال الصورة للمستخدم (بدون كشف الرابط الأصلي)
    imageResponse.data.pipe(res);

  } catch (err) {
    console.error(`Image Proxy Error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
};
