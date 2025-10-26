// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة ---
const escapeMarkdown = (text) => {
  if (text === null || typeof text === 'undefined') {
    return '';
  }
  const str = String(text);
  // قائمة الحروف الخاصة بـ MarkdownV2 التي يجب عمل "escape" لها
  // _ * [ ] ( ) ~ ` > # + - = | { } . !
  return str.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
};

const getYouTubeID = (url) => {
  if (!url) return null;
  
  // Regex للتعامل مع كل أشكال روابط يوتيوب (watch, youtu.be, shorts, etc.)
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=|\?v=)([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    // الرابط صحيح وتم استخراج الكود
    return match[2];
  } else if (url.length === 11) {
    // المستخدم أدخل الكود مباشرة (كدعم للطريقة القديمة)
    return url;
  }
  
  // لم يتم العثور على كود صالح
  return null;
};

// [تم التعديل] دالة لإرسال الرسائل تدعم parse_mode مختلف
// [تم التعديل] دالة لإرسال الرسائل تدعم parse_mode مختلف
// وتقوم بعمل Escape تلقائي لـ MarkdownV2
const sendMessage = async (chatId, text, reply_markup = null, parse_mode = 'MarkdownV2') => {
    if (!text || text.trim() === '') {
        console.warn(`Attempted to send empty message to chat ID: ${chatId}`);
        return;
    }

    // ✅ [الحل هنا]
    // نقوم بتهريب النص تلقائيًا فقط إذا كان الوضع هو MarkdownV2
    const processedText = (parse_mode === 'MarkdownV2') ? escapeMarkdown(text) : text;

    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: processedText, // <--- نستخدم النص المُعالج
            ...(reply_markup && { reply_markup }),
            parse_mode: parse_mode,
            protect_content: true
        });
    } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error.response?.data || error.message);
        
        // [تحسين إضافي]
        // إذا فشل الإرسال بسبب خطأ Markdown، نحاول الإرسال مرة أخرى كنص عادي
        if (error.response && error.response.data && error.response.data.description.includes("can't parse entities")) {
            console.warn(`Markdown parsing failed for chat ${chatId}. Resending as plain text.`);
            try {
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: chatId,
                    text: text, // <--- نستخدم النص الأصلي
                    ...(reply_markup && { reply_markup }),
                    // لا نرسل parse_mode (سيستخدم الوضع الافتراضي)
                    protect_content: true
                });
            } catch (retryError) {
                console.error(`Failed to resend plain text message to chat ${chatId}:`, retryError.response?.data || retryError.message);
            }
        }
    }
};
const answerCallbackQuery = async (callbackQueryId) => {
  await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  });
};

// [مُعدلة] getUser لا تسجل الأسماء، وترجع كائن أساسي عند الفشل
const getUser = async (userId) => {
  const selectQuery = 'id, is_subscribed, is_admin, admin_state, state_data';
  let userData = null;

  try {
      const { data, error } = await supabase
          .from('users')
          .select(selectQuery)
          .eq('id', userId)
          .single();

      if (error && error.code === 'PGRST116') { // Not found
          console.log(`User ${userId} not found, inserting with basic info...`);
          const newUser = { id: userId, is_subscribed: false, is_admin: false };
          const { data: insertedUser, error: insertError } = await supabase
              .from('users')
              .insert(newUser)
              .select(selectQuery)
              .single();

          if (insertError) {
              console.error(`Error inserting user ${userId}:`, insertError);
              return { id: userId, is_subscribed: false, is_admin: false };
          }
          console.log(`User ${userId} inserted successfully.`);
          userData = insertedUser;
      } else if (error) {
          console.error(`Error fetching user ${userId}:`, error);
          return { id: userId, is_subscribed: false, is_admin: false };
      } else {
          userData = data; // المستخدم موجود
      }
  } catch (catchError) {
      console.error(`Unexpected error in getUser for ${userId}:`, catchError);
      return { id: userId, is_subscribed: false, is_admin: false };
  }
  return userData || { id: userId, is_subscribed: false, is_admin: false };
};


const setAdminState = async (userId, state, data = null) => {
  await supabase
    .from('users')
    .update({ admin_state: state, state_data: data })
    .eq('id', userId);
};

// --- دوال الأدمن (كما هي) ---
const sendAdminMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '📚 إدارة المحتوى', callback_data: 'admin_manage_content' }],
    ],
  };
  await sendMessage(chatId, 'Panel Admin:\nاختر القسم:', keyboard);
};

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

const sendUserMenu = async (chatId) => {
   const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة/تحديث مستخدمين', callback_data: 'admin_add_users' }],
      [{ text: '❌ سحب الصلاحيات (محدد/كامل)', callback_data: 'admin_revoke_permissions' }],
      [{ text: '🔄 إعادة تعيين جهاز (حذف البصمة)', callback_data: 'admin_reset_device' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await sendMessage(chatId, 'إدارة المستخدمين:', keyboard);
};

const fetchAndSendCoursesMenu = async (chatId, text, stateData, callback_prefix) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error || !courses || courses.length === 0) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على كورسات\\. أضف كورسات أولاً\\.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_course_selection', stateData);
  const keyboard = courses.map(c => ([{ text: escapeMarkdown(c.title), callback_data: `${callback_prefix}_${c.id}` }]));
  if (callback_prefix === 'assign_course') {
     keyboard.unshift([{ text: '✅ منح صلاحية لكل الكورسات', callback_data: 'assign_all_courses' }]);
     keyboard.push([{ text: '👍 إنهاء ومنح الصلاحيات المحددة', callback_data: 'assign_finish' }]);
  }
  if (callback_prefix === 'select_video_course') {
     keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_content' }]);
  }
  await sendMessage(chatId, text, { inline_keyboard: keyboard });
};

const fetchAndSendVideosMenu = async (chatId, courseId) => {
  const { data: videos, error } = await supabase.from('videos').select('id, title').eq('course_id', courseId).order('id');
  if (error || !videos || videos.length === 0) {
    await sendMessage(chatId, 'لا توجد فيديوهات في هذا الكورس\\.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_video_deletion', { course_id: courseId });
  const keyboard = videos.map(v => ([{ text: escapeMarkdown(v.title), callback_data: `delete_video_confirm_${v.id}` }]));
  keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_content' }]);
  await sendMessage(chatId, 'اختر الفيديو الذي تريد حذفه:', { inline_keyboard: keyboard });
};

// قائمة سحب الصلاحيات التفاعلية (تعرض الـ ID فقط)
const sendRevokeMenu = async (adminChatId, targetUserId) => {
  try {
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', targetUserId)
      .single();

    if (!targetUser || (userError && userError.code === 'PGRST116')) {
      await sendMessage(adminChatId, `خطأ: المستخدم \`${targetUserId}\` غير موجود في قاعدة البيانات\\.`);
      return;
    }
    if (userError) throw userError;

    const { data: accessData, error: accessError } = await supabase
      .from('user_course_access')
      .select('course_id')
      .eq('user_id', targetUserId);
    if (accessError) throw accessError;

    let courses = [];
    if (accessData && accessData.length > 0) {
      const courseIds = accessData.map(a => a.course_id);
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds);
      if (coursesError) throw coursesError;
      courses = coursesData;
    }

    let message = `*مراجعة صلاحيات المستخدم:*\n`;
    message += `👤 \`${targetUserId}\`\n\n`;

    if (targetUser.is_subscribed) {
      message += "الحالة: 💎 *مشترك \\(صلاحية كاملة\\)*\n";
    } else {
      message += "الحالة: 🔒 *صلاحية محددة*\n";
    }

    const keyboard = [];

    if (courses.length > 0) {
      message += "*الكورسات المحددة:*\n";
      courses.forEach(course => {
        const cleanCourseTitle = escapeMarkdown(course.title);
        message += `\\- ${cleanCourseTitle}\n`;
        keyboard.push([{
          text: `❌ سحب [${cleanCourseTitle}]`,
          callback_data: `revoke_specific_${targetUserId}_course_${course.id}`
        }]);
      });
    } else {
      message += "لا يمتلك صلاحية لأي كورس محدد\\.\n";
    }

    keyboard.unshift([{
      text: '⛔️ سحب "جميع" الصلاحيات',
      callback_data: `revoke_all_${targetUserId}`
    }]);
    keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' }]);

    await sendMessage(adminChatId, message, { inline_keyboard: keyboard });

  } catch (error) {
    console.error("Error in sendRevokeMenu:", error);
    await sendMessage(adminChatId, `حدث خطأ أثناء جلب بيانات المستخدم: ${escapeMarkdown(error.message)}`);
    await setAdminState(adminChatId, null, null);
  }
};


// --- الـ Webhook الرئيسي ---
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let user, chatId, userId, text;

  try {
    const { message, callback_query } = req.body;

    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id); // الأدمن
      user = await getUser(userId); // لا نحتاج from هنا
      const command = callback_query.data;
      await answerCallbackQuery(callback_query.id);

      if (!user) {
          console.error("Failed to get admin user:", userId);
          if (chatId) await sendMessage(chatId, "حدث خطأ في جلب بيانات الأدمن\\.");
          return res.status(200).send('OK');
      }

      if (!user.is_admin) {
        await sendMessage(chatId, 'أنت لست أدمن\\.');
        return res.status(200).send('OK');
      }

      // --- 1. معالجة أزرار التنقل الرئيسية ---
      if (command === 'admin_main_menu') {
        await setAdminState(userId, null, null);
        await sendAdminMenu(chatId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_users') {
        await setAdminState(userId, null, null);
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
        await sendMessage(chatId, '👤 أرسل الآن ID واحد أو أكثر \\(افصل بينهم بمسافة أو سطر جديد\\):');
        return res.status(200).send('OK');
      }
      if (command === 'admin_reset_device') {
        await setAdminState(userId, 'awaiting_device_reset_id');
        await sendMessage(chatId, '👤 أرسل ID المستخدم \\(أو عدة IDs\\) الذي تريد حذف بصمته:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_revoke_permissions') {
        await setAdminState(userId, 'awaiting_user_id_for_revoke');
        await sendMessage(chatId, '👤 أرسل *ID المستخدم الواحد* الذي تريد مراجعة صلاحياته:');
        return res.status(200).send('OK');
      }

      // "صلاحية كاملة"
      if (command === 'assign_all_courses') {
        if (!user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة\\. يرجى البدء من جديد\\.");
            return res.status(200).send(await setAdminState(userId, null, null));
        }
        const usersToUpdate = user.state_data.users;
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: true }));
        const { error } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (error) {
           await sendMessage(chatId, `حدث خطأ: ${escapeMarkdown(error.message)}`);
        } else {
           await sendMessage(chatId, `✅ تم منح صلاحية كاملة لـ ${usersToUpdate.length} مستخدم\\.`);
        }
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }

      // "صلاحية محددة" (اختيار كورس)
      if (command.startsWith('assign_course_')) {
         if (!user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة\\. يرجى البدء من جديد\\.");
            return res.status(200).send(await setAdminState(userId, null, null));
        }
        const courseId = parseInt(command.split('_')[2], 10);
        if (isNaN(courseId)){
             await sendMessage(chatId, "خطأ في تحديد الكورس\\. يرجى المحاولة مرة أخرى\\.");
             return res.status(200).send(await setAdminState(userId, null, null));
        }
        const stateData = user.state_data;
        const usersToUpdate = stateData.users;

        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: false }));
        const { error: userUpsertError } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (userUpsertError) {
          await sendMessage(chatId, `حدث خطأ أثناء تحديث المستخدمين: ${escapeMarkdown(userUpsertError.message)}`);
          return res.status(200).send(await setAdminState(userId, null, null));
        }

        const accessObjects = usersToUpdate.map(uid => ({ user_id: uid, course_id: courseId }));
        const { error: accessUpsertError } = await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
        if (accessUpsertError) {
           await sendMessage(chatId, `حدث خطأ أثناء إضافة الصلاحية: ${escapeMarkdown(accessUpsertError.message)}`);
           return res.status(200).send(await setAdminState(userId, null, null));
        }

        const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
        const courseName = course ? escapeMarkdown(course.title) : 'المحدد';

        const finishKeyboard = {
          inline_keyboard: [[{ text: '👍 إنهاء', callback_data: 'assign_finish' }]]
        };
        await sendMessage(
          chatId,
          `✅ تم إضافة صلاحية كورس *${courseName}*\\.\n اختر كورساً آخر \\(من القائمة السابقة\\) أو اضغط "إنهاء"\\.`,
          finishKeyboard
        );
        return res.status(200).send('OK');
      }

      // "إنهاء" الصلاحيات المحددة
      if (command === 'assign_finish') {
         await sendMessage(chatId, `👍 تم حفظ الصلاحيات المحددة للمستخدمين\\.`);
         await setAdminState(userId, null, null);
         return res.status(200).send('OK');
      }

      // معالجات أزرار سحب الصلاحيات
      if (command.startsWith('revoke_all_')) {
        const targetUserId = command.split('_')[2];
        await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب "جميع" الصلاحيات من المستخدم \`${targetUserId}\`\\.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_specific_')) {
        const parts = command.split('_');
        const targetUserId = parts[2];
        const courseId = parts[4];

        await supabase.from('user_course_access').delete().match({ user_id: targetUserId, course_id: courseId });
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);

        await sendMessage(chatId, `✅ تم سحب صلاحية الكورس\\. جاري تحديث القائمة\\.\\.\\.`);
        await sendRevokeMenu(chatId, targetUserId); // تحديث القائمة
        return res.status(200).send('OK');
      }

      // زر تنبيه المستخدم الجديد
      if (command.startsWith('admin_grant_access_')) {
        const targetUserId = command.split('_')[3];
        await setAdminState(userId, null, null); // Clear any previous state
        await fetchAndSendCoursesMenu(
          chatId,
          `🔑 منح صلاحيات للمستخدم \`${targetUserId}\`\\.\nاختر نوع الصلاحية:`,
          { users: [targetUserId] },
          'assign_course'
        );
        return res.status(200).send('OK');
      }


      // --- (باقي أزرار إدارة المحتوى والحذف كما هي) ---
       if (command === 'admin_add_course') {
        await setAdminState(userId, 'awaiting_course_title');
        await sendMessage(chatId, '📚 أرسل "اسم" الكورس الجديد:');
        return res.status(200).send('OK');
      }
      // ... (باقي الأزرار كما في الكود السابق) ...
      if (command === 'admin_add_video') {
        await setAdminState(userId, 'awaiting_video_title');
        await sendMessage(chatId, '🚀 أرسل "عنوان" الفيديو:');
        return res.status(200).send('OK');
      }
     if (command.startsWith('add_video_to_course_')) {
         if (!user.state_data || !user.state_data.video) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة\\. يرجى البدء من جديد\\.");
            return res.status(200).send(await setAdminState(userId, null, null));
        }
        const courseId = parseInt(command.split('_')[4], 10);
        if (isNaN(courseId)) {
           await sendMessage(chatId, 'خطأ: لم يتم التعرف على الكورس\\. تم الإلغاء\\.');
           return res.status(200).send(await setAdminState(userId, null, null));
        }
        const videoData = user.state_data.video;

        // --- [ ✅ الحل هنا ] ---
        // 1. نقوم بالتقاط الخطأ المحتمل
        const { error: insertError } = await supabase.from('videos').insert({ ...videoData, course_id: courseId });

        // 2. نتحقق من الخطأ
        if (insertError) {
            console.error("Error inserting video:", insertError);
            // 3. نرسل رسالة الخطأ الحقيقية للأدمن بدلاً من رسالة النجاح
            await sendMessage(chatId, `❌ حدث خطأ أثناء إضافة الفيديو: ${insertError.message}`);
        } else {
            // 4. نرسل رسالة النجاح فقط إذا لم يكن هناك خطأ
            await sendMessage(chatId, '✅✅✅ تم إضافة الفيديو بنجاح!');
        }
        // --- [ نهاية الحل ] ---

        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command === 'admin_delete_course') {
        await fetchAndSendCoursesMenu(chatId, 'اختر الكورس الذي تريد حذفه:', {}, 'delete_course_confirm');
        return res.status(200).send('OK');
      }
      if (command.startsWith('delete_course_confirm_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await supabase.from('videos').delete().eq('course_id', courseId);
        await supabase.from('user_course_access').delete().eq('course_id', courseId);
        await supabase.from('courses').delete().eq('id', courseId);
        await sendMessage(chatId, `🗑️ تم حذف الكورس وكل فيديوهاته وصلاحياته بنجاح\\.`);
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
        await sendMessage(chatId, `🗑️ تم حذف الفيديو بنجاح\\.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }

      return res.status(200).send('OK');
    }

    // --- 3. معالجة الرسائل النصية (لإدخال البيانات) ---
    if (message && message.text && message.from) {
      chatId = message.chat.id;
      userId = String(message.from.id);
      text = message.text;
      // [تم التعديل] getUser لا تحتاج from هنا
      user = await getUser(userId);

      if (!user) {
          console.error("Failed to get user:", userId);
          if (chatId) await sendMessage(chatId, "حدث خطأ في جلب بيانات المستخدم\\.");
          return res.status(200).send('OK');
      }


      // أمر /start
      if (text === '/start') {
        if (user.is_admin) {
          await sendAdminMenu(chatId);
        } else {
          // التحقق من صلاحيات المستخدم (كاملة أو محددة)
           const { count, error: accessCheckError } = await supabase
            .from('user_course_access')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);


          if (accessCheckError && accessCheckError.code !== 'PGRST116') {
                console.error("Error checking user access:", accessCheckError);
                await sendMessage(chatId, "حدث خطأ أثناء التحقق من صلاحياتك\\.");
                return res.status(200).send('OK');
           }

          const hasSpecificAccess = count > 0;

          if (user.is_subscribed || hasSpecificAccess) {
            await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات\\.');
          } else {
            // ليس لديه أي صلاحيات (مستخدم جديد)
            await sendMessage(chatId, 'أنت غير مشترك في الخدمة\\. تم إرسال طلبك إلى الأدمن للمراجعة\\.');

            // --- [هذا هو الكود الخاص بتنبيه الأدمن] ---
            const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
            if (admins && admins.length > 0) {
              // نحتاج بيانات المستخدم من الرسالة الأصلية
              const newUserInfoFromMessage = message.from;

              // --- [تعديل] استخدام HTML هنا ---
              const userName = `${newUserInfoFromMessage.first_name || ''} ${newUserInfoFromMessage.last_name || ''}`.trim();
              const userLink = `tg://user?id=${newUserInfoFromMessage.id}`;
              const userUsername = newUserInfoFromMessage.username ? `@${newUserInfoFromMessage.username}` : 'لا يوجد';
              const language = newUserInfoFromMessage.language_code || 'غير محدد';
              const isPremium = newUserInfoFromMessage.is_premium ? 'نعم ✅' : 'لا ❌';

              // جلب العدد الكلي للمستخدمين
              const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });

              let notificationMessage = `👤 <b>مستخدم جديد انضم!</b>\n\n` +
                                        `<b>الاسم:</b> <a href="${userLink}">${userName}</a>\n` +
                                        `<b>المعرف:</b> ${userUsername}\n` +
                                        `<b>ID:</b> <code>${newUserInfoFromMessage.id}</code>\n` +
                                        `<b>لغة التلجرام:</b> ${language}\n` +
                                        `<b>حساب بريميوم:</b> ${isPremium}\n\n` +
                                        `👥 أصبح العدد الكلي للمستخدمين: <b>${totalUsers || 0}</b>`;


              const grantAccessKeyboard = {
                inline_keyboard: [[
                  // لا نحتاج تنظيف الاسم هنا لأنه ليس جزءاً من callback_data
                  { text: `🔑 منح صلاحيات لـ ${userName || 'المستخدم'}`, callback_data: `admin_grant_access_${newUserInfoFromMessage.id}` }
                ]]
              };
              for (const admin of admins) {
                 try {
                     // إرسال باستخدام HTML
                     await sendMessage(admin.id, notificationMessage, grantAccessKeyboard, 'HTML');
                 } catch (sendError) {
                     console.error(`Failed to send new user alert to admin ${admin.id}:`, sendError.message);
                 }
              }
            }
            // --- [نهاية كود تنبيه الأدمن] ---
          }
        }
        return res.status(200).send('OK');
      }

      // أمر /cancel
      if (user.is_admin && text === '/cancel') {
         await setAdminState(userId, null, null);
         await sendMessage(chatId, '👍 تم إلغاء العملية\\.');
         return res.status(200).send('OK');
      }

      // معالجة الحالات (State Machine)
      if (user.is_admin && user.admin_state) {
        switch (user.admin_state) {

          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await sendMessage(chatId, 'خطأ\\. أرسل IDs صالحة\\. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            await fetchAndSendCoursesMenu(
              chatId,
              `تم تحديد ${ids.length} مستخدم\\. اختر نوع الصلاحية:`,
              { users: ids },
              'assign_course'
            );
            break;

          case 'awaiting_device_reset_id':
            const resetIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (resetIds.length === 0) {
              await sendMessage(chatId, 'خطأ\\. أرسل IDs صالحة\\. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            const { error: deleteError } = await supabase
              .from('devices')
              .delete()
              .in('user_id', resetIds);

            if (deleteError) {
               await sendMessage(chatId, `حدث خطأ: ${escapeMarkdown(deleteError.message)}`);
            } else {
               await sendMessage(chatId, `✅ تم حذف البصمات المسجلة لـ ${resetIds.length} مستخدم\\.`);
            }
            await setAdminState(userId, null, null);
            break;

          case 'awaiting_user_id_for_revoke':
            const revokeIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (revokeIds.length !== 1) {
                 await sendMessage(chatId, 'خطأ\\. هذه الميزة تعمل لمستخدم واحد فقط في كل مرة\\. أرسل ID واحد فقط\\.');
                 return res.status(200).send('OK');
            }
            const targetUserId = revokeIds[0];
            await setAdminState(userId, null, null);
            await sendRevokeMenu(chatId, targetUserId); // إظهار القائمة التفاعلية
            break;

          // (باقي الحالات كما هي)
          case 'awaiting_course_title':
            await supabase.from('courses').insert({ title: text });
            await sendMessage(chatId, `✅ تم إضافة الكورس "${escapeMarkdown(text)}" بنجاح\\.`);
            await setAdminState(userId, null, null);
            break;
          case 'awaiting_video_title':
            await setAdminState(userId, 'awaiting_youtube_id', { video: { title: text } });
            // ✅ [تعديل] نطلب الرابط بدلاً من الكود
            await sendMessage(chatId, `👍 العنوان: "${escapeMarkdown(text)}"\n\nالآن أرسل "رابط يوتيوب" (Link) الخاص بالفيديو:`);
            break;
          case 'awaiting_youtube_id':
             if (!user.state_data || !user.state_data.video) {
                await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة. يرجى البدء من جديد.");
                return res.status(200).send(await setAdminState(userId, null, null));
            }

            // --- [ ✅ تعديل: معالجة الرابط ] ---
            const videoUrl = text; // النص المُرسل هو الرابط
            const videoId = getYouTubeID(videoUrl); // نستخرج الكود من الرابط

            // 1. التحقق إذا كان الرابط صالحاً
            if (!videoId) {
                await sendMessage(chatId, 'خطأ: الرابط الذي أرسلته غير صالح. أرسل رابط يوتيوب صحيح أو اضغط /cancel');
                // نبقى في نفس الحالة وننتظر رابط صحيح
                return res.status(200).send('OK');
            }

            // 2. الرابط صالح، نكمل العملية
            const videoData = user.state_data.video;
            videoData.youtube_video_id = videoId; // نحفظ الكود المُستخرج

            await fetchAndSendCoursesMenu(
              chatId,
              // نغير الرسالة لتأكيد النجاح
              `👍 تم استخراج كود الفيديو بنجاح.\n\nالآن، اختر الكورس الذي ينتمي إليه هذا الفيديو:`,
              { video: videoData },
              'add_video_to_course'
            );
            break;
            // --- [ نهاية التعديل ] ---
        }
        return res.status(200).send('OK');
      }

      // رسالة عامة
      if (!user.admin_state) {
        await sendMessage(chatId, 'الأمر غير معروف\\. اضغط /start');
      }
    }

  } catch (e) {
    console.error("Error in webhook:", e);
    if (chatId) {
        try {
           await sendMessage(chatId, `حدث خطأ جسيم في الخادم: ${escapeMarkdown(e.message)}`);
        } catch (sendError) {
             console.error("Failed to send critical error message to admin:", sendError);
        }
    }
  }

  res.status(200).send('OK');
};
