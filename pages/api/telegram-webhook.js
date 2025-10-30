// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة (بدون تغيير) ---
const escapeMarkdown = (text) => {
  if (text === null || typeof text === 'undefined') {
    return '';
  }
  const str = String(text);
  return str.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
};

const getYouTubeID = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=|\?v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  } else if (url.length === 11) {
    return url;
  }
  return null;
};

const sendMessage = async (chatId, text, reply_markup = null, parse_mode = 'MarkdownV2') => {
    if (!text || text.trim() === '') {
        console.warn(`Attempted to send empty message to chat ID: ${chatId}`);
        return;
    }
    const processedText = (parse_mode === 'MarkdownV2') ? escapeMarkdown(text) : text;
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: processedText,
            ...(reply_markup && { reply_markup }),
            parse_mode: parse_mode,
            protect_content: true
        });
    } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error.response?.data || error.message);
        if (error.response && error.response.data && error.response.data.description.includes("can't parse entities")) {
            console.warn(`Markdown parsing failed for chat ${chatId}. Resending as plain text.`);
            try {
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: chatId,
                    text: text,
                    ...(reply_markup && { reply_markup }),
                    protect_content: true
                });
            } catch (retryError) {
                console.error(`Failed to resend plain text message to chat ${chatId}:`, retryError.response?.data || retryError.message);
            }
        }
    }
};

const answerCallbackQuery = async (callbackQueryId) => {
  try {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
    });
  } catch (e) {
    console.error("Failed to answer callback query:", e.message);
  }
};

const getUser = async (userId) => {
  const selectQuery = 'id, is_subscribed, is_admin, admin_state, state_data';
  let userData = null;
  try {
      const { data, error } = await supabase
          .from('users')
          .select(selectQuery)
          .eq('id', userId)
          .single();
      if (error && error.code === 'PGRST116') {
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
          userData = insertedUser;
      } else if (error) {
          console.error(`Error fetching user ${userId}:`, error);
          return { id: userId, is_subscribed: false, is_admin: false };
      } else {
          userData = data;
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

// --- دوال الأدمن (الرئيسية والمستخدمين) ---
const sendAdminMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '🗂️ إدارة المحتوى', callback_data: 'admin_manage_content' }],
    ],
  };
  await sendMessage(chatId, 'Panel Admin:', keyboard);
};

const sendUserMenu = async (chatId) => {
   const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة/تحديث مستخدمين', callback_data: 'admin_add_users' }],
      [{ text: '❌ سحب الصلاحيات', callback_data: 'admin_revoke_permissions' }],
      [{ text: '🔄 إعادة تعيين جهاز', callback_data: 'admin_reset_device' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await sendMessage(chatId, '👤 إدارة المستخدمين:', keyboard);
};

const fetchAndSendCoursesMenu = async (chatId, text, stateData, callback_prefix) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error || !courses || courses.length === 0) {
    await sendMessage(chatId, 'خطأ: لا توجد كورسات\\. أضف كورسات أولاً\\.');
    await setAdminState(chatId, null, null);
    return;
  }
  await setAdminState(chatId, 'awaiting_course_selection', stateData);
  const keyboard = courses.map(c => ([{ text: escapeMarkdown(c.title), callback_data: `${callback_prefix}_${c.id}` }]));
  if (callback_prefix === 'assign_course') {
     keyboard.unshift([{ text: '✅ صلاحية كاملة', callback_data: 'assign_all_courses' }]);
     keyboard.push([{ text: '👍 إنهاء ومنح (محدد)', callback_data: 'assign_finish' }]);
  }
  await sendMessage(chatId, text, { inline_keyboard: keyboard });
};

const sendRevokeMenu = async (adminChatId, targetUserId) => {
  try {
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', targetUserId)
      .single();

    if (!targetUser || (userError && userError.code === 'PGRST116')) {
      await sendMessage(adminChatId, `خطأ: المستخدم \`${targetUserId}\` غير موجود\\.`);
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

    let message = `*صلاحيات المستخدم:*\n👤 \`${targetUserId}\`\n\n`;
    message += (targetUser.is_subscribed) ? "الحالة: 💎 *صلاحية كاملة*\n" : "الحالة: 🔒 *صلاحية محددة*\n";

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
    }
    keyboard.unshift([{
      text: '⛔️ سحب "جميع" الصلاحيات',
      callback_data: `revoke_all_${targetUserId}`
    }]);
    keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' }]);
    await sendMessage(adminChatId, message, { inline_keyboard: keyboard });
  } catch (error) {
    console.error("Error in sendRevokeMenu:", error);
    await sendMessage(adminChatId, `حدث خطأ: ${escapeMarkdown(error.message)}`);
    await setAdminState(adminChatId, null, null);
  }
};


// --- [ ✅✅ دوال إدارة المحتوى الهرمية (مُعدلة) ] ---

// (الدالة 1: عرض الكورسات)
const sendContentMenu_Courses = async (chatId) => {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, title')
    .order('title');
    
  if (error) {
    await sendMessage(chatId, `خطأ في جلب الكورسات: ${escapeMarkdown(error.message)}`);
    return;
  }

  const keyboard = [];
  if (courses && courses.length > 0) {
    courses.forEach(course => {
      keyboard.push([{
        text: `📚 ${escapeMarkdown(course.title)}`,
        callback_data: `content_nav_course_${course.id}`
      }]);
    });
  }
  
  keyboard.push([{ text: '➕ إضافة كورس جديد', callback_data: 'content_add_course' }]);
  keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }]);

  await setAdminState(chatId, null, null);
  await sendMessage(chatId, '🗂️ *المحتوى: الكورسات*', { inline_keyboard: keyboard });
};

// (الدالة 2: عرض المجلدات داخل الكورس)
const sendContentMenu_Folders = async (chatId, courseId) => {
  const { data: course, error } = await supabase
    .from('courses')
    .select('title, sections (id, title)') // sections = المجلدات
    .eq('id', courseId)
    .single();

  if (error || !course) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على الكورس.');
    return;
  }
  const courseTitle = escapeMarkdown(course.title);
  const sections = course.sections || [];

  const keyboard = [];
  sections.forEach(section => {
    keyboard.push([{
      text: `📁 ${escapeMarkdown(section.title)}`,
      callback_data: `content_nav_folder_${section.id}`
    }]);
  });
  keyboard.push([
    { text: '➕ إضافة مجلد', callback_data: `content_add_folder_${courseId}` },
    { text: '❌ حذف مجلد', callback_data: `content_del_folder_menu_${courseId}` } // <-- ✅ تعديل
  ]);
  keyboard.push([{ text: '🗑️ حذف هذا الكورس بالكامل', callback_data: `delete_course_confirm_${courseId}` }]);
  keyboard.push([{ text: '🔙 رجوع (للكورسات)', callback_data: 'admin_manage_content' }]);

  await setAdminState(chatId, null, { current_course_id: courseId }); // نحفظ الكورس الحالي
  await sendMessage(chatId, `📚 *الكورس: ${courseTitle}*`, { inline_keyboard: keyboard });
};

// (الدالة 3: عرض الفيديوهات داخل المجلد)
const sendContentMenu_Videos = async (chatId, sectionId) => {
  const { data: section, error } = await supabase
    .from('sections')
    .select('title, course_id, videos (id, title)')
    .eq('id', sectionId)
    .single();

  if (error || !section) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على المجلد.');
    return;
  }
  const sectionTitle = escapeMarkdown(section.title);
  const courseId = section.course_id;
  const videos = section.videos || [];

  const keyboard = [];
  videos.forEach(video => {
    keyboard.push([{
      text: `▶️ ${escapeMarkdown(video.title)}`,
      callback_data: `content_del_video_${video.id}_${sectionId}` // زر لحذف الفيديو + نمرر ID المجلد
    }]);
  });
  
  if (videos.length === 0) {
      keyboard.push([{ text: '(لا توجد فيديوهات بعد)', callback_data: 'noop' }]);
  }
  keyboard.push([
    { text: '➕ إضافة فيديو', callback_data: `content_add_video_${sectionId}` },
    { text: '❌ حذف فيديو (اضغط عليه)', callback_data: 'noop' }
  ]);
  keyboard.push([{ text: '🔙 رجوع (للمجلدات)', callback_data: `content_nav_course_${courseId}` }]);

  await setAdminState(chatId, null, { current_folder_id: sectionId, current_course_id: courseId }); // نحفظ المجلد والكورس
  await sendMessage(chatId, `📁 *المجلد: ${sectionTitle}*`, { inline_keyboard: keyboard });
};

// --- [ ✅✅ ميزة جديدة: قائمة حذف المجلدات ] ---
const sendFolderDeletionMenu = async (chatId, courseId) => {
  const { data: sections, error } = await supabase
    .from('sections')
    .select('id, title')
    .eq('course_id', courseId);

  if (error || !sections || sections.length === 0) {
    await sendMessage(chatId, 'لا توجد مجلدات لحذفها.');
    await sendContentMenu_Folders(chatId, courseId); // الرجوع خطوة
    return;
  }

  const keyboard = [];
  sections.forEach(section => {
    keyboard.push([{
      text: `❌ حذف [${escapeMarkdown(section.title)}]`,
      // نمرر ID المجلد + ID الكورس (للرجوع)
      callback_data: `content_confirm_del_folder_${section.id}_${courseId}` 
    }]);
  });
  keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: `content_nav_course_${courseId}` }]);
  
  await sendMessage(chatId, 'اختر المجلد الذي تريد حذفه (سيتم حذف كل الفيديوهات بداخله):', { inline_keyboard: keyboard });
};

// دالة وهمية للأزرار غير القابلة للضغط
const noop = (chatId) => {
    // لا تفعل شيئاً
};

// --- الـ Webhook الرئيسي ---
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let user, chatId, userId, text;

  try {
    const { message, callback_query } = req.body;

    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id);
      user = await getUser(userId);
      const command = callback_query.data;
      await answerCallbackQuery(callback_query.id);

      if (!user) { return res.status(200).send('OK'); } // فشل جلب المستخدم
      if (!user.is_admin) {
        await sendMessage(chatId, 'أنت لست أدمن\\.');
        return res.status(200).send('OK');
      }
      if(command === 'noop') {
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

      // --- [ ✅✅ نظام إدارة المحتوى الجديد ] ---
      if (command === 'admin_manage_content') {
        await sendContentMenu_Courses(chatId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_nav_course_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await sendContentMenu_Folders(chatId, courseId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_nav_folder_')) {
        const folderId = parseInt(command.split('_')[3], 10);
        await sendContentMenu_Videos(chatId, folderId);
        return res.status(200).send('OK');
      }
      if (command === 'content_add_course') {
        await setAdminState(userId, 'awaiting_course_title');
        await sendMessage(chatId, 'أرسل اسم الكورس الجديد: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_add_folder_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await setAdminState(userId, 'awaiting_folder_title', { course_id: courseId });
        await sendMessage(chatId, 'أرسل اسم المجلد الجديد: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_add_video_')) {
        const sectionId = parseInt(command.split('_')[3], 10);
        await setAdminState(userId, 'awaiting_video_title', { section_id: sectionId });
        await sendMessage(chatId, 'أرسل عنوان الفيديو: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      
      // --- [ ✅✅ ميزة حذف المجلدات (مكتملة) ] ---
      if (command.startsWith('content_del_folder_menu_')) {
        const courseId = parseInt(command.split('_')[4], 10);
        await sendFolderDeletionMenu(chatId, courseId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_confirm_del_folder_')) {
        const folderId = parseInt(command.split('_')[4], 10);
        const courseId = parseInt(command.split('_')[5], 10);
        // Cascade delete سيحذف المجلد والفيديوهات بداخله
        await supabase.from('sections').delete().eq('id', folderId);
        await sendMessage(chatId, '🗑️ تم حذف المجلد بنجاح\\.');
        await sendContentMenu_Folders(chatId, courseId); // تحديث القائمة
        return res.status(200).send('OK');
      }
      // --- [ نهاية ميزة حذف المجلدات ] ---

      if (command.startsWith('content_del_video_')) {
        const videoId = parseInt(command.split('_')[3], 10);
        const sectionId = parseInt(command.split('_')[4], 10);
        await supabase.from('videos').delete().eq('id', videoId);
        await sendMessage(chatId, '🗑️ تم حذف الفيديو\\. (جاري تحديث القائمة...)');
        await sendContentMenu_Videos(chatId, sectionId); // تحديث القائمة
        return res.status(200).send('OK');
      }
      if (command.startsWith('delete_course_confirm_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await supabase.from('courses').delete().eq('id', courseId);
        await sendMessage(chatId, `🗑️ تم حذف الكورس وكل محتوياته بنجاح\\.`);
        await sendContentMenu_Courses(chatId); // العودة لقائمة الكورسات
        return res.status(200).send('OK');
      }

      // --- 2. معالجة أزرار "إدارة المستخدمين" (كما هي) ---
      if (command === 'admin_add_users') {
        await setAdminState(userId, 'awaiting_user_ids');
        await sendMessage(chatId, 'أرسل IDs المستخدمين (افصل بينهم بمسافة):');
        return res.status(200).send('OK');
      }
      if (command === 'admin_reset_device') {
        await setAdminState(userId, 'awaiting_device_reset_id');
        await sendMessage(chatId, 'أرسل ID المستخدم لحذف بصمته:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_revoke_permissions') {
        await setAdminState(userId, 'awaiting_user_id_for_revoke');
        await sendMessage(chatId, 'أرسل ID المستخدم لمراجعة صلاحياته:');
        return res.status(200).send('OK');
      }
      if (command === 'assign_all_courses') {
        if (!user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات مفقودة\\. ابدأ من جديد\\.");
            return res.status(200).send(await setAdminState(userId, null, null));
        }
        const usersToUpdate = user.state_data.users;
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: true }));
        const { error } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (error) { await sendMessage(chatId, `حدث خطأ: ${escapeMarkdown(error.message)}`); }
        else { await sendMessage(chatId, `✅ تم منح صلاحية كاملة لـ ${usersToUpdate.length} مستخدم\\.`); }
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('assign_course_')) {
         if (!user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات مفقودة\\. ابدأ من جديد\\.");
            return res.status(200).send(await setAdminState(userId, null, null));
        }
        const courseId = parseInt(command.split('_')[2], 10);
        const stateData = user.state_data;
        const usersToUpdate = stateData.users;
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: false }));
        await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        const accessObjects = usersToUpdate.map(uid => ({ user_id: uid, course_id: courseId }));
        await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
        const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
        const courseName = course ? escapeMarkdown(course.title) : 'المحدد';
        const finishKeyboard = { inline_keyboard: [[{ text: '👍 إنهاء', callback_data: 'assign_finish' }]] };
        await sendMessage(chatId, `✅ تمت إضافة *${courseName}*\\. اختر كورساً آخر أو اضغط "إنهاء"\\.`, finishKeyboard );
        return res.status(200).send('OK');
      }
      if (command === 'assign_finish') {
         await sendMessage(chatId, `👍 تم حفظ الصلاحيات المحددة\\.`);
         await setAdminState(userId, null, null);
         return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_all_')) {
        const targetUserId = command.split('_')[2];
        await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب "جميع" الصلاحيات من \`${targetUserId}\`\\.`);
        await setAdminState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_specific_')) {
        const parts = command.split('_');
        const targetUserId = parts[2];
        const courseId = parts[4];
        await supabase.from('user_course_access').delete().match({ user_id: targetUserId, course_id: courseId });
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب صلاحية الكورس\\. (جاري تحديث القائمة...)`);
        await sendRevokeMenu(chatId, targetUserId); // تحديث القائمة
        return res.status(200).send('OK');
      }
      if (command.startsWith('admin_grant_access_')) {
        const targetUserId = command.split('_')[3];
        await setAdminState(userId, null, null);
        await fetchAndSendCoursesMenu(
          chatId,
          `🔑 منح صلاحيات للمستخدم \`${targetUserId}\`\\:`,
          { users: [targetUserId] },
          'assign_course'
        );
        return res.status(200).send('OK');
      }
      return res.status(200).send('OK');
    }

    // --- 3. معالجة الرسائل النصية (لإدخال البيانات) ---
    if (message && message.text && message.from) {
      chatId = message.chat.id;
      userId = String(message.from.id);
      text = message.text;
      user = await getUser(userId);

      if (!user) {
          console.error("Failed to get user:", userId);
          return res.status(200).send('OK');
      }

      // أمر /start
      if (text === '/start') {
        if (user.is_admin) {
          await sendAdminMenu(chatId);
        } else {
           const { count, error: accessCheckError } = await supabase
            .from('user_course_access')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          if (accessCheckError && accessCheckError.code !== 'PGRST116') {
                await sendMessage(chatId, "حدث خطأ أثناء التحقق من صلاحياتك\\.");
                return res.status(200).send('OK');
           }
          const hasSpecificAccess = count > 0;
          if (user.is_subscribed || hasSpecificAccess) {
            await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات\\.');
          } else {
            await sendMessage(chatId, 'أنت غير مشترك\\. تم إرسال طلبك للأدمن للمراجعة\\.');
            const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
            if (admins && admins.length > 0) {
              const newUserInfoFromMessage = message.from;
              const userName = `${newUserInfoFromMessage.first_name || ''} ${newUserInfoFromMessage.last_name || ''}`.trim();
              const userLink = `tg://user?id=${newUserInfoFromMessage.id}`;
              const userUsername = newUserInfoFromMessage.username ? `@${newUserInfoFromMessage.username}` : 'لا يوجد';
              const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
              let notificationMessage = `👤 <b>مستخدم جديد انضم!</b>\n` +
                                        `<b>الاسم:</b> <a href="${userLink}">${userName}</a>\n` +
                                        `<b>المعرف:</b> ${userUsername}\n` +
                                        `<b>ID:</b> <code>${newUserInfoFromMessage.id}</code>\n` +
                                        `👥 العدد الكلي للمستخدمين: <b>${totalUsers || 0}</b>`;
              const grantAccessKeyboard = {
                inline_keyboard: [[
                  { text: `🔑 منح صلاحيات لـ ${userName || 'المستخدم'}`, callback_data: `admin_grant_access_${newUserInfoFromMessage.id}` }
                ]]
              };
              for (const admin of admins) {
                 try {
                     await sendMessage(admin.id, notificationMessage, grantAccessKeyboard, 'HTML');
                 } catch (sendError) {
                     console.error(`Failed to send new user alert to admin ${admin.id}:`, sendError.message);
                 }
              }
            }
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

          // (حالات إدارة المستخدمين)
          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await sendMessage(chatId, 'خطأ\\. أرسل IDs صالحة\\. (أو /cancel)');
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
              await sendMessage(chatId, 'خطأ\\. أرسل IDs صالحة\\. (أو /cancel)');
              return res.status(200).send('OK');
            }
            const { error: deleteError } = await supabase
              .from('devices')
              .delete()
              .in('user_id', resetIds);
            if (deleteError) { await sendMessage(chatId, `حدث خطأ: ${escapeMarkdown(deleteError.message)}`); }
            else { await sendMessage(chatId, `✅ تم حذف البصمات لـ ${resetIds.length} مستخدم\\.`); }
            await setAdminState(userId, null, null);
            break;
          case 'awaiting_user_id_for_revoke':
            const revokeIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (revokeIds.length !== 1) {
                 await sendMessage(chatId, 'خطأ\\. أرسل ID واحد فقط\\. (أو /cancel)');
                 return res.status(200).send('OK');
            }
            const targetUserId = revokeIds[0];
            await setAdminState(userId, null, null);
            await sendRevokeMenu(chatId, targetUserId);
            break;

          // --- [ ✅✅ تعديل حالات المحتوى ] ---
          case 'awaiting_course_title':
            await supabase.from('courses').insert({ title: text });
            await sendMessage(chatId, `✅ تم إضافة الكورس "${escapeMarkdown(text)}"\\.`);
            await setAdminState(userId, null, null);
            await sendContentMenu_Courses(chatId); // تحديث القائمة
            break;

          case 'awaiting_folder_title':
            if (!user.state_data || !user.state_data.course_id) {
               await sendMessage(chatId, "خطأ: بيانات مفقودة\\. (أو /cancel)");
               await setAdminState(userId, null, null);
               break;
            }
            await supabase.from('sections').insert({ title: text, course_id: user.state_data.course_id });
            await sendMessage(chatId, `✅ تم إضافة المجلد "${escapeMarkdown(text)}"\\.`);
            await sendContentMenu_Folders(chatId, user.state_data.course_id); // تحديث القائمة
            break;

          case 'awaiting_video_title':
            if (!user.state_data || !user.state_data.section_id) {
               await sendMessage(chatId, "خطأ: بيانات مفقودة\\. (أو /cancel)");
               await setAdminState(userId, null, null);
               break;
            }
            await setAdminState(userId, 'awaiting_youtube_id', { 
                section_id: user.state_data.section_id, 
                video_title: text 
            });
            await sendMessage(chatId, `👍 العنوان: "${escapeMarkdown(text)}"\n\nالآن أرسل رابط يوتيوب: (أو /cancel)`);
            break;

          case 'awaiting_youtube_id':
            if (!user.state_data || !user.state_data.section_id || !user.state_data.video_title) {
               await sendMessage(chatId, "خطأ: الحالة مفقودة. (أو /cancel)");
               await setAdminState(userId, null, null);
               break;
            }
            const videoUrl = text;
            const videoId = getYouTubeID(videoUrl);
            if (!videoId) {
                await sendMessage(chatId, 'خطأ: الرابط غير صالح. أرسل رابط يوتيوب صحيح أو /cancel');
                break; // نبقى في نفس الحالة
            }
            
            await supabase.from('videos').insert({ 
                title: user.state_data.video_title,
                youtube_video_id: videoId,
                section_id: user.state_data.section_id // ✅ الربط بالمجلد
            });

            await sendMessage(chatId, '✅ تم إضافة الفيديو بنجاح!');
            await sendContentMenu_Videos(chatId, user.state_data.section_id); // تحديث القائمة
            break;
            
        } // نهاية الـ switch
        return res.status(200).send('OK');
      }

      if (!user.admin_state) {
        await sendMessage(chatId, 'الأمر غير معروف\\. اضغط /start');
      }
    }

  } catch (e) {
    console.error("Error in webhook:", e);
    if (chatId) {
        try {
           await sendMessage(chatId, `حدث خطأ جسيم: ${escapeMarkdown(e.message)}`);
        } catch (sendError) {
             console.error("Failed to send critical error message to admin:", sendError);
        }
    }
  }

  res.status(200).send('OK');
};
