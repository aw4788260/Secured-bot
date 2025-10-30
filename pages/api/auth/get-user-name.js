// pages/api/auth/get-user-name.js
import axios from 'axios';

export default async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  // 1. جلب توكن البوت بأمان من متغيرات البيئة
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is not set on Vercel!");
      return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    // 2. استدعاء Telegram API (getChat)
    // هذا آمن تماماً لأن التوكن يبقى على الخادم ولا يراه المستخدم
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`,
      { params: { chat_id: userId } }
    );

    // 3. التحقق من الرد
    if (response.data && response.data.ok) {
      // (نجح) إرجاع الاسم الأول للمستخدم
      const firstName = response.data.result.first_name || 'User';
      return res.status(200).json({ name: firstName });
    } else {
      // (فشل - غالباً لأن المستخدم لم يبدأ البوت)
      console.warn("getChat failed (User might not have started bot):", response.data.description);
      // إرجاع اسم افتراضي
      return res.status(200).json({ name: `User ${userId}` });
    }

  } catch (err) {
    // (فشل حرج - مثل أن الـ ID غير صحيح أو البوت محظور)
    console.error("Error fetching getChat:", err.response ? err.response.data : err.message);
    // إرجاع اسم افتراضي
    return res.status(200).json({ name: `User ${userId}` });
  }
};
