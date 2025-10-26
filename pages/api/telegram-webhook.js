// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

// --- (الدوال المساعدة تبقى كما هي) ---
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const sendMessage = async (chatId, text) => {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
  });
};

const getUser = async (userId) => {
  // هذه الدالة تتوقع userId كـ number
  const { data, error } = await supabase
    .from('users')
    .select('id, is_subscribed, is_admin, admin_state, state_data')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') { // not found
    const { data: newUser } = await supabase
      .from('users')
      .insert({ id: userId, is_subscribed: false, is_admin: false }) // تستخدم number
      .select('id, is_subscribed, is_admin, admin_state, state_data')
      .single();
    return newUser;
  }
  return data;
};

const setAdminState = async (userId, state, data = null) => {
  // هذه الدالة تتوقع userId كـ number
  await supabase
    .from('users')
    .update({ admin_state: state, state_data: data })
    .eq('id', userId);
};

// --- الـ Webhook الرئيسي (مع التحديث الجديد) ---
export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const { message } = req.body;
    if (!message || !message.text || !message.from) {
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    // هنا ID المستخدم هو number وهو ما تتوقعه getUser
    const userId = message.from.id; 
    const text = message.text;

    const user = await getUser(userId); // استدعاء getUser بـ number

    // --- منطقة الأدمن ---
    if (user && user.is_admin) {
      if (text.startsWith('/adduser')) {
        const targetUserId = text.split(' ')[1];
        if (!targetUserId || !/^\d+$/.test(targetUserId)) {
          await sendMessage(chatId, 'خطأ. الصيغة: /adduser 123456789');
        } else {
          // --- **هذا هو التعديل** ---
          // نستخدم parseInt لتحويل النص إلى number ليتطابق مع باقي الدوال
          await supabase
            .from('users')
            .upsert({ id: parseInt(targetUserId, 10), is_subscribed: true }, { onConflict: 'id' });
          // -------------------------
          await sendMessage(chatId, `✅ تم تفعيل الاشتراك للمستخدم ${targetUserId}.`);
        }
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }

      // ... (باقي أوامر الأدمن كما هي) ...
      if (text === '/addcourse') {
        await setAdminState(userId, 'awaiting_course_title');
        await sendMessage(chatId, '📚 حسناً، أرسل "اسم" الكورس الجديد:');
        return res.status(200).send('OK');
      }

      if (text === '/addvideo') {
        await setAdminState(userId, 'awaiting_video_title');
        await sendMessage(chatId, '🚀 حسناً، أرسل "عنوان" الفيديو:');
        return res.status(200).send('OK');
      }
      
      if (text === '/cancel') {
        await setAdminState(userId, null, null);
        await sendMessage(chatId, '👍 تم إلغاء العملية.');
        return res.status(200).send('OK');
      }

      // ... (باقي معالجة الحالات كما هي) ...
      if (user.admin_state) {
        switch (user.admin_state) {
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

    // --- منطقة المستخدم العادي ---
    if (text === '/start') {
      if (user && user.is_subscribed) {
        await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات.');
      } else {
        await sendMessage(chatId, 'أنت غير مشترك في الخدمة.');
      }
      return res.status(200).send('OK');
    }
    
    await sendMessage(chatId, 'الأمر غير معروف. اضغط /start');

  } catch (e) {
    // هذا السطر هو الذي أظهر الخطأ
    console.error("Error in webhook:", e.message); 
  }
  res.status(200).send('OK');
};
