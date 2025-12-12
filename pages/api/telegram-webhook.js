import axios from 'axios';

// إعداد رابط API تليجرام
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export default async (req, res) => {
  // 1. التحقق الأمني (Secret Token)
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
      return res.status(401).send('Unauthorized');
  }

  // الرد على طلبات GET للتأكد من عمل السيرفر
  if (req.method !== 'POST') return res.status(200).send('OK');

  try {
    const { message } = req.body;

    // الرد فقط إذا كانت رسالة نصية (مثل /start)
    if (message && message.chat) {
        const chatId = message.chat.id;

        // إرسال الرسالة النصية فقط (بدون أزرار)
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "أهلاً بك"
        });
    }

  } catch (error) {
    console.error('Webhook Error:', error.message);
  }

  // إنهاء الطلب بنجاح دائماً
  res.status(200).send('OK');
};
