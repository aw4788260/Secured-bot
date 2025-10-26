// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة ---

const sendMessage = async (chatId, text) => {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
  });
};

// دالة جديدة لإرسال قائمة الأدمن
const sendAdminMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '➕ إضافة مستخدم', callback_data: 'admin_adduser' },
      ],
      [
        { text: '📚 إضافة كورس', callback_data: 'admin_addcourse' },
        { text: '▶️ إضافة فيديو', callback_data: 'admin_addvideo' },
      ],
    ],
  };

  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: 'Panel Admin:\nاختر أحد الأوامر:',
    reply_markup: keyboard,
  });
};

// دالة جديدة للرد على ضغطة الزر (لإخفاء علامة التحميل)
const answerCallbackQuery = async (callbackQueryId) => {
  await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  });
};

const getUser = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, is_subscribed, is_admin, admin_state, state_data')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') { // not found
    const { data: newUser } = await supabase
      .from('users')
      .insert({ id: userId, is_subscribed: false, is_admin: false })
      .select('id, is_subscribed, is_admin, admin_state, state_data')
      .single();
    return newUser;
  }
  return data;
};

const setAdminState = async (userId, state, data = null) => {
  await supabase
    .from('users')
    .update({ admin_state: state, state_data: data })
    .eq('id', userId);
};

// --- الـ Webhook الرئيسي (معدل بالكامل) ---
export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const { message, callback_query } = req.body;

    // --- 1. معالجة ضغطات الأزرار (Callback Queries) ---
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const userId = callback_query.from.id;
      const command = callback_query.data;

      // إرسال رد فوري للزر
      await answerCallbackQuery(callback_query.id);

      const user = await getUser(userId);

      if (user && user.is_admin) {
        switch (command) {
          case 'admin_adduser':
            await setAdminState(userId, 'awaiting_user_id');
            await sendMessage(chatId, '👤 أرسل الآن "ID" المستخدم الذي تريد تفعيل اشتراكه:');
            break;
          case 'admin_addcourse':
            await setAdminState(userId, 'awaiting_course_title');
            await sendMessage(chatId, '📚 حسناً، أرسل "اسم" الكورس الجديد:');
            break;
          case 'admin_addvideo':
            await setAdminState(userId, 'awaiting_video_title');
            await sendMessage(chatId, '🚀 حسناً، أرسل "عنوان" الفيديو:');
            break;
        }
      } else {
        await sendMessage(chatId, 'أنت لست أدمن.');
      }
      return res.status(200).send('OK');
    }

    // --- 2. معالجة الرسائل النصية ---
    if (message && message.text && message.from) {
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;

      const user = await getUser(userId);

      // --- منطقة الأدمن (معالجة الحالات) ---
      if (user && user.is_admin) {
        // أمر الإلغاء
        if (text === '/cancel') {
          await setAdminState(userId, null, null);
          await sendMessage(chatId, '👍 تم إلغاء العملية.');
          return res.status(200).send('OK');
        }

        // معالجة المحادثة (الحالة)
        if (user.admin_state) {
          switch (user.admin_state) {
            
            // --- حالة جديدة: إضافة مستخدم ---
            case 'awaiting_user_id':
              const targetUserId = text;
              if (!targetUserId || !/^\d+$/.test(targetUserId)) {
                await sendMessage(chatId, 'خطأ. أرسل ID صحيح (أرقام فقط). حاول مجدداً أو اضغط /cancel');
              } else {
                await supabase
                  .from('users')
                  .upsert({ id: parseInt(targetUserId, 10), is_subscribed: true }, { onConflict: 'id' });
                await sendMessage(chatId, `✅ تم تفعيل الاشتراك للمستخدم ${targetUserId}.`);
                await setAdminState(userId, null, null);
              }
              break;

            // --- حالة إضافة كورس ---
            case 'awaiting_course_title':
              const { data: newCourse, error } = await supabase
                .from('courses')
                .insert({ title: text })
                .select('id')
                .single();

              if (error) {
                await sendMessage(chatId, `حدث خطأ: ${error.message}`);
              } else {
                await sendMessage(chatId, `✅ تم إضافة الكورس "${text}" بنجاح!\n\nرقم الكورس (Course ID) هو: \`${newCourse.id}\`\n(استخدم هذا الرقم عند إضافة الفيديوهات)`);
              }
              await setAdminState(userId, null, null);
              break;

            // --- حالات إضافة الفيديو ---
            case 'awaiting_video_title':
              await setAdminState(userId, 'awaiting_youtube_id', { title: text });
              await sendMessage(chatId, `👍 العنوان: "${text}"\n\nالآن أرسل "كود يوتيوب":`);
              break;
            case 'awaiting_youtube_id':
              const title = user.state_data.title;
              await setAdminState(userId, 'awaiting_course_id', { title: title, youtube_id: text });
              await sendMessage(chatId, `👍 كود اليوتيوب: "${text}"\n\nالآن أرسل "رقم الكورس" (Course ID):`);
              break;
            case 'awaiting_course_id':
              const videoData = user.state_data;
              const courseId = parseInt(text);
              if (isNaN(courseId)) {
                await sendMessage(chatId, 'خطأ. أرسل "رقم" الكورس. حاول مجدداً:');
                break;
              }
              const { error: videoError } = await supabase.from('videos').insert({
                title: videoData.title,
                youtube_video_id: videoData.youtube_id,
                course_id: courseId
              });
              if (videoError) {
                await sendMessage(chatId, `حدث خطأ: ${videoError.message}`);
              } else {
                await sendMessage(chatId, '✅✅✅ تم إضافة الفيديو بنجاح!');
              }
              await setAdminState(userId, null, null);
              break;
          }
          return res.status(200).send('OK');
        }
      } // نهاية منطقة الأدمن

      // --- منطقة المستخدم العادي و أمر /start ---
      if (text === '/start') {
        if (user && user.is_admin) {
          // إذا كان أدمن، أرسل له لوحة التحكم
          await sendAdminMenu(chatId);
        } else if (user && user.is_subscribed) {
          await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات.');
        } else {
          await sendMessage(chatId, 'أنت غير مشترك في الخدمة.');
        }
        return res.status(200).send('OK');
      }
      
      // إذا لم يكن في حالة إدخال بيانات، والمستخدم ليس أدمن
      if (!user.admin_state) {
         await sendMessage(chatId, 'الأمر غير معروف. اضغط /start');
      }

    } // نهاية معالجة الرسائل النصية

  } catch (e) {
    console.error("Error in webhook:", e.message);
  }
  
  // إرسال رد 200 OK دائماً في النهاية
  res.status(200).send('OK');
};
