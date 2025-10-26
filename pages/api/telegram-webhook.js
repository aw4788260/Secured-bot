// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة (كما هي) ---
const sendMessage = async (chatId, text, reply_markup = null) => {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
    ...(reply_markup && { reply_markup }),
  });
};

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
  if (error && error.code === 'PGRST116') { 
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

// --- دوال الأدمن ---

// 1. القائمة الرئيسية للأدمن
const sendAdminMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '📚 إدارة المحتوى', callback_data: 'admin_manage_content' }],
    ],
  };
  await sendMessage(chatId, 'Panel Admin:\nاختر القسم:', keyboard);
};

// 2. قائمة إدارة المحتوى
const sendContentMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة كورس', callback_data: 'admin_add_course' }, { text: '➕ إضافة فيديو', callback_data: 'admin_add_video' }],
      [{ text: '❌ حذف كورس', callback_data: 'admin_delete_course' }, { text: '❌ حذف فيديو', callback_data: 'admin_delete_video' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await sendMessage(chatId, 'إدارة المحتوى:', keyboard);
};

// 3. قائمة إدارة المستخدمين --- [تم التعديل] ---
const sendUserMenu = async (chatId) => {
   const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة/تحديث مستخدمين', callback_data: 'admin_add_users' }],
      // [جديد] زر حذف البصمة
      [{ text: '🔄 إعادة تعيين جهاز (حذف البصمة)', callback_data: 'admin_reset_device' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await sendMessage(chatId, 'إدارة المستخدمين:', keyboard);
};

// 4. قائمة جلب الكورسات (للاختيار منها)
const fetchAndSendCoursesMenu = async (chatId, text, stateData, callback_prefix) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error || !courses || courses.length === 0) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على كورسات. أضف كورسات أولاً.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_course_selection', stateData);
  const keyboard = courses.map(c => ([{ text: c.title, callback_data: `${callback_prefix}_${c.id}` }]));
  if (callback_prefix === 'assign_course') {
     keyboard.unshift([{ text: '✅ منح صلاحية لكل الكورسات', callback_data: 'assign_all_courses' }]);
     keyboard.push([{ text: '👍 إنهاء ومنح الصلاحيات المحددة', callback_data: 'assign_finish' }]);
  }
  if (callback_prefix === 'select_video_course') {
     keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_content' }]);
  }
  await sendMessage(chatId, text, { inline_keyboard: keyboard });
};

// 5. قائمة جلب الفيديوهات (لحذف فيديو)
const fetchAndSendVideosMenu = async (chatId, courseId) => {
  const { data: videos, error } = await supabase.from('videos').select('id, title').eq('course_id', courseId).order('id');
  if (error || !videos || videos.length === 0) {
    await sendMessage(chatId, 'لا توجد فيديوهات في هذا الكورس.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_video_deletion', { course_id: courseId });
  const keyboard = videos.map(v => ([{ text: v.title, callback_data: `delete_video_confirm_${v.id}` }]));
  keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_content' }]);
  await sendMessage(chatId, 'اختر الفيديو الذي تريد حذفه:', { inline_keyboard: keyboard });
};

// --- الـ Webhook الرئيسي ---
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let user, chatId, userId, text;

  try {
    const { message, callback_query } = req.body;

    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id); // استخدام string دائماً
      user = await getUser(userId);
      const command = callback_query.data;
      await answerCallbackQuery(callback_query.id);

      if (!user || !user.is_admin) {
        await sendMessage(chatId, 'أنت لست أدمن.');
        return res.status(200).send('OK');
      }

      // --- 1. معالجة أزرار التنقل الرئيسية ---
      if (command === 'admin_main_menu') {
        await setAdminState(userId, null, null);
        await sendAdminMenu(chatId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_users') {
        await sendUserMenu(chatId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_content') {
        await setAdminState(userId, null, null);
        await sendContentMenu(chatId);
        return res.status(200).send('OK');
      }

      // --- 2. معالجة أزرار "إدارة المستخدمين" ---
      if (command === 'admin_add_users') {
        await setAdminState(userId, 'awaiting_user_ids');
        await sendMessage(chatId, '👤 أرسل الآن ID واحد أو أكثر (افصل بينهم بمسافة أو سطر جديد):');
        return res.status(200).send('OK');
      }

      // --- [جديد] معالجة زر حذف البصمة ---
      if (command === 'admin_reset_device') {
        await setAdminState(userId, 'awaiting_device_reset_id');
        await sendMessage(chatId, '👤 أرسل ID المستخدم (أو عدة IDs) الذي تريد حذف بصمته (للسماح له بالتسجيل من جديد):');
        return res.status(200).send('OK');
      }
      
      // "صلاحية كاملة"
      if (command === 'assign_all_courses') {
        const usersToUpdate = user.state_data.users; 
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: true }));
        const { error } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (error) {
           await sendMessage(chatId, `حدث خطأ: ${error.message}`);
        } else {
           await sendMessage(chatId, `✅ تم منح صلاحية كاملة لـ ${usersToUpdate.length} مستخدم.`);
        }
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      
      // "صلاحية محددة" (اختيار كورس)
      if (command.startsWith('assign_course_')) {
        const courseId = parseInt(command.split('_')[2], 10); 
        const stateData = user.state_data; 
        const usersToUpdate = stateData.users; 
        
        // الخطوة 1: ضمان وجود المستخدمين في جدول 'users' أولاً
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: false }));
        const { error: userUpsertError } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (userUpsertError) {
          await sendMessage(chatId, `حدث خطأ أثناء تحديث المستخدمين: ${userUpsertError.message}`);
          return res.status(200).send(await setAdminState(userId, null, null));
        }

        // الخطوة 2: الآن يمكن إضافة الصلاحيات بأمان
        const accessObjects = usersToUpdate.map(uid => ({ user_id: uid, course_id: courseId }));
        const { error: accessUpsertError } = await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
        if (accessUpsertError) {
           await sendMessage(chatId, `حدث خطأ أثناء إضافة الصلاحية: ${accessUpsertError.message}`);
           return res.status(200).send(await setAdminState(userId, null, null));
        }

        // --- [هذا هو التعديل] ---
        // إرسال رسالة التأكيد ومعها زر الإنهاء
        const finishKeyboard = {
          inline_keyboard: [[{ text: '👍 إنهاء', callback_data: 'assign_finish' }]]
        };
        await sendMessage(
          chatId,
          `✅ تم إضافة صلاحية الكورس المحدد. اختر كورساً آخر (من القائمة السابقة) أو اضغط "إنهاء".`,
          finishKeyboard 
        );
        return res.status(200).send('OK');
      }
      
      // "إنهاء" الصلاحيات المحددة
      if (command === 'assign_finish') {
         await sendMessage(chatId, `👍 تم حفظ الصلاحيات المحددة للمستخدمين.`);
         await setAdminState(userId, null, null);
         return res.status(200).send('OK');
      }

      // --- 3. معالجة أزرار "إدارة المحتوى" ---
      if (command === 'admin_add_course') {
        await setAdminState(userId, 'awaiting_course_title');
        await sendMessage(chatId, '📚 أرسل "اسم" الكورس الجديد:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_add_video') {
        await setAdminState(userId, 'awaiting_video_title');
        await sendMessage(chatId, '🚀 أرسل "عنوان" الفيديو:');
        return res.status(200).send('OK');
      }
      if (command.startsWith('add_video_to_course_')) {
        const courseId = parseInt(command.split('_')[4], 10); 
        if (user.admin_state !== 'awaiting_course_selection' || !user.state_data.video || isNaN(courseId)) {
           await sendMessage(chatId, 'حالة غير متوقعة. تم الإلغاء.');
           return res.status(200).send(await setAdminState(userId, null, null));
        }
        const videoData = user.state_data.video; 
        await supabase.from('videos').insert({ ...videoData, course_id: courseId });
        await sendMessage(chatId, '✅✅✅ تم إضافة الفيديو بنجاح!');
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      
      // --- 4. معالجة أزرار "إدارة المحتوى" (حذف) ---
      if (command === 'admin_delete_course') {
        await fetchAndSendCoursesMenu(chatId, 'اختر الكورس الذي تريد حذفه:', {}, 'delete_course_confirm');
        return res.status(200).send('OK');
      }
      if (command.startsWith('delete_course_confirm_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await supabase.from('videos').delete().eq('course_id', courseId);
        await supabase.from('user_course_access').delete().eq('course_id', courseId);
        await supabase.from('courses').delete().eq('id', courseId);
        await sendMessage(chatId, `🗑️ تم حذف الكورس وكل فيديوهاته وصلاحياته بنجاح.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command === 'admin_delete_video') {
         await fetchAndSendCoursesMenu(chatId, 'أولاً، اختر "الكورس" الذي يحتوي على الفيديو:', {}, 'select_video_course');
         return res.status(200).send('OK');
      }
      if (command.startsWith('select_video_course_')) {
         const courseId = parseInt(command.split('_')[3], 10);
         await fetchAndSendVideosMenu(chatId, courseId);
         return res.status(200).send('OK');
      }
      if (command.startsWith('delete_video_confirm_')) {
        const videoId = parseInt(command.split('_')[3], 10);
        await supabase.from('videos').delete().eq('id', videoId);
        await sendMessage(chatId, `🗑️ تم حذف الفيديو بنجاح.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }

      return res.status(200).send('OK');
    }

    // --- 3. معالجة الرسائل النصية (لإدخال البيانات) ---
    if (message && message.text && message.from) {
      chatId = message.chat.id;
      userId = String(message.from.id); // استخدام string دائماً
      text = message.text;
      user = await getUser(userId);

      // أمر /start
      if (text === '/start') {
        if (user && user.is_admin) {
          await sendAdminMenu(chatId);
        } else if (user && user.is_subscribed) {
          await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات.');
        } else {
          await sendMessage(chatId, 'أنت غير مشترك في الخدمة أو ليس لديك صلاحية لأي كورس.');
        }
        return res.status(200).send('OK');
      }
      
      // أمر /cancel
      if (user && user.is_admin && text === '/cancel') {
         await setAdminState(userId, null, null);
         await sendMessage(chatId, '👍 تم إلغاء العملية.');
         return res.status(200).send('OK');
      }

      // معالجة الحالات (State Machine)
      if (user && user.is_admin && user.admin_state) {
        switch (user.admin_state) {
          
          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await sendMessage(chatId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            await fetchAndSendCoursesMenu(
              chatId, 
              `تم تحديد ${ids.length} مستخدم. اختر نوع الصلاحية:`, 
              { users: ids }, // تخزين (string[])
              'assign_course'
            );
            break;
          
          // --- [جديد] حالة حذف البصمة ---
          case 'awaiting_device_reset_id':
            const resetIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (resetIds.length === 0) {
              await sendMessage(chatId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            
            // حذف البصمات من جدول devices
            const { error: deleteError } = await supabase
              .from('devices')
              .delete()
              .in('user_id', resetIds); // .in() لحذف كل الـ IDs

            if (deleteError) {
               await sendMessage(chatId, `حدث خطأ: ${deleteError.message}`);
            } else {
               await sendMessage(chatId, `✅ تم حذف البصمات المسجلة لـ ${resetIds.length} مستخدم. يمكنهم الآن التسجيل من جديد.`);
            }
            await setAdminState(userId, null, null);
            break;

          // (باقي الحالات كما هي)
          case 'awaiting_course_title':
            await supabase.from('courses').insert({ title: text });
            await sendMessage(chatId, `✅ تم إضافة الكورس "${text}" بنجاح.`);
            await setAdminState(userId, null, null);
            break;
          case 'awaiting_video_title':
            await setAdminState(userId, 'awaiting_youtube_id', { video: { title: text } });
            await sendMessage(chatId, `👍 العنوان: "${text}"\n\nالآن أرسل "كود يوتيوب":`);
            break;
          case 'awaiting_youtube_id':
            const videoData = user.state_data.video;
            videoData.youtube_id = text;
            await fetchAndSendCoursesMenu(
              chatId,
              '👍 تم حفظ كود اليوتيوب.\n\الآن، اختر الكورس الذي ينتمي إليه هذا الفيديو:',
              { video: videoData }, 
              'add_video_to_course'
            );
            break;
        }
        return res.status(200).send('OK');
      }

      // رسالة عامة
      if (!user.admin_state) {
        await sendMessage(chatId, 'الأمر غير معروف. اضغط /start');
      }
    }

  } catch (e) {
    console.error("Error in webhook:", e.message);
    if (chatId) {
       await sendMessage(chatId, `حدث خطأ جسيم في الخادم: ${e.message}`);
    }
  }
  
  res.status(200).send('OK');
};
