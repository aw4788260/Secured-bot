// pages/api/exams/get-image.js
import axios from 'axios';
import { supabase } from '../../../lib/supabaseClient';
import { checkUserAccess } from '../../../lib/authHelper'; // استيراد دالة التحقق

export default async (req, res) => {
  // 1. [✅ تعديل] استقبال userId و deviceId بالإضافة لـ file_id
  const { file_id, userId, deviceId } = req.query;

  if (!file_id || !userId || !deviceId) {
    return res.status(400).json({ error: 'Missing file_id, userId, or deviceId' });
  }

  // التحقق من إعدادات السيرفر
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is not set!");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 2. [🔒 حماية] البحث عن الامتحان الذي تتبع له هذه الصورة
    // نبحث في جدول الأسئلة (questions) لأن الصور مخزنة هناك
    const { data: questionData, error: qError } = await supabase
        .from('questions')
        .select('exam_id')
        .eq('image_file_id', file_id)
        .limit(1)
        .maybeSingle(); // استخدام maybeSingle أفضل لتجنب الاستثناءات

    if (qError || !questionData) {
        // إذا لم نجد الصورة في القاعدة، نرفض الطلب
        return res.status(404).json({ error: 'Image context not found in database' });
    }

    // 3. [🔒 حماية] التحقق من صلاحية المستخدم لهذا الامتحان + بصمة الجهاز
    // نمرر examId كمعامل رابع، و deviceId كمعامل خامس
    const hasAccess = await checkUserAccess(userId, null, null, questionData.exam_id, deviceId);
    
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access Denied: Device Mismatch or No Subscription.' });
    }

    // 4. طلب مسار الملف من تليجرام (الكود الأصلي)
    const getFileUrl = `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await axios.get(getFileUrl);

    if (!fileInfoResponse.data.ok) {
      throw new Error(fileInfoResponse.data.description || 'Failed to get file info from Telegram');
    }

    const file_path = fileInfoResponse.data.result.file_path;

    // 5. بناء رابط التحميل المباشر وتوجيه المستخدم (الكود الأصلي)
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
    res.redirect(307, downloadUrl);

  } catch (err) {
    console.error(`Error proxying Telegram image (file_id: ${file_id}):`, err.message);
    res.status(404).json({ error: 'Image not found or proxy failed' });
  }
};
