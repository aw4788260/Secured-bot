// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة (Escape و YouTube ID) ---
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

// --- دوال إرسال الرسائل ---

/**
 * دالة إرسال الرسائل الرئيسية
 * @param {boolean} protect_content - (افتراضي: false) هل الرسالة محمية
 */
const sendMessage = async (chatId, text, reply_markup = null, parse_mode = 'MarkdownV2', protect_content = false) => {
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
            protect_content: protect_content
        });
    } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error.response?.data || error.message);
        
        if (error.response && error.response.data && error.response.data.description.includes("can't parse entities")) {
            console.warn(`Markdown parsing failed for chat ${chatId}. Resending as plain text.`);
            try {
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: chatId,
                    text: text, // النص الأصلي
                    ...(reply_markup && { reply_markup }),
                    protect_content: protect_content
                });
            } catch (retryError) {
                console.error(`Failed to resend plain text message to chat ${chatId}:`, retryError.response?.data || retryError.message);
            }
        }
    }
};

/**
 * دالة إرسال الصورة (للأدمن)
 * تستخدم HTML دائماً ولا تحمي المحتوى
 */
const sendPhotoMessage = async (chatId, photo_file_id, caption, reply_markup = null) => {
    try {
        await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: photo_file_id,
            caption: caption,
            parse_mode: 'HTML', 
            ...(reply_markup && { reply_markup }),
            protect_content: false // الأدمن يمكنه النسخ
        });
    } catch (error) {
         console.error(`Failed to send photo to chat ${chatId}:`, error.response?.data || error.message);
    }
};

// دالة الرد على Callback Query
const answerCallbackQuery = async (callbackQueryId) => {
  try {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
    });
  } catch (e) {
      console.error("Failed to answer callback query:", e.message);
  }
};

// --- دوال إدارة قواعد البيانات (المستخدم والحالة) ---

/**
 * جلب بيانات المستخدم أو إنشاء مستخدم جديد
 * [ ✅ إصلاح: تم الرجوع إلى 'admin_state' ]
 */
const getUser = async (userId) => {
  const selectQuery = 'id, is_subscribed, is_admin, admin_state, state_data'; // <-- تم الإرجاع إلى admin_state
  let userData = null;
  try {
      const { data, error } = await supabase
          .from('users')
          .select(selectQuery)
          .eq('id', userId)
          .single();
          
      if (error && error.code === 'PGRST116') { // المستخدم غير موجود
          console.log(`User ${userId} not found, inserting...`);
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
          // هذا هو الخطأ الذي ظهر عندك
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

/**
 * تحديث حالة المستخدم (للمحادثات متعددة الخطوات)
 * [ ✅ إصلاح: تم الرجوع إلى 'admin_state' ]
 */
const setUserState = async (userId, state, data = null) => {
  try {
    await supabase
      .from('users')
      .update({ admin_state: state, state_data: data }) // <-- تم الإرجاع إلى admin_state
      .eq('id', userId);
  } catch(e) {
      console.error("Failed to set user state:", e.message);
  }
};

// --- دوال الأدمن: القوائم الرئيسية ---

const sendAdminMenu = async (chatId) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '📨 طلبات الاشتراك', callback_data: 'admin_view_requests' }],
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '🗂️ إدارة المحتوى', callback_data: 'admin_manage_content' }],
    ],
  };
  await sendMessage(chatId, 'Panel Admin:\nاختر القسم:', keyboard);
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

// --- دوال الأدمن: إدارة صلاحيات المستخدمين ---

const fetchAndSendCoursesMenu = async (chatId, text, stateData, callback_prefix) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error || !courses || courses.length === 0) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على كورسات\\. أضف كورسات أولاً\\.');
    await setUserState(chatId, null, null);
    return;
  }
  await setUserState(chatId, 'awaiting_course_selection', stateData); // حالة مؤقتة
  const keyboard = courses.map(c => ([{ text: escapeMarkdown(c.title), callback_data: `${callback_prefix}_${c.id}` }]));
  if (callback_prefix === 'assign_course') {
     keyboard.unshift([{ text: '✅ منح صلاحية لكل الكورسات', callback_data: 'assign_all_courses' }]);
     keyboard.push([{ text: '👍 إنهاء ومنح الصلاحيات المحددة', callback_data: 'assign_finish' }]);
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
    if (userError && userError.code === 'PGRST116') {
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
    let message = `*مراجعة صلاحيات المستخدم:*\n👤 \`${targetUserId}\`\n\n`;
    message += targetUser.is_subscribed ? "الحالة: 💎 *مشترك \\(صلاحية كاملة\\)*\n" : "الحالة: 🔒 *صلاحية محددة*\n";
    const keyboard = [];
    if (courses.length > 0) {
      message += "*الكورسات المحددة:*\n";
      courses.forEach(course => {
        const cleanCourseTitle = escapeMarkdown(course.title);
        message += `\\- ${cleanCourseTitle}\n`;
        keyboard.push([{ text: `❌ سحب [${cleanCourseTitle}]`, callback_data: `revoke_specific_${targetUserId}_course_${course.id}`}]);
      });
    } else {
      message += "لا يمتلك صلاحية لأي كورس محدد\\.\n";
    }
    keyboard.unshift([{ text: '⛔️ سحب "جميع" الصلاحيات', callback_data: `revoke_all_${targetUserId}`}]);
    keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' }]);
    await sendMessage(adminChatId, message, { inline_keyboard: keyboard });
  } catch (error) {
    console.error("Error in sendRevokeMenu:", error);
    await sendMessage(adminChatId, `حدث خطأ: ${escapeMarkdown(error.message)}`);
    await setUserState(adminChatId, null, null);
  }
};

// --- دوال الأدمن: إدارة المحتوى الهرمية ---

const sendContentMenu_Courses = async (chatId) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error) {
    await sendMessage(chatId, `خطأ في جلب الكورسات: ${escapeMarkdown(error.message)}`);
    return;
  }
  const keyboard = [];
  if (courses && courses.length > 0) {
    courses.forEach(course => {
      keyboard.push([{ text: `📚 ${escapeMarkdown(course.title)}`, callback_data: `content_nav_course_${course.id}`}]);
    });
  }
  keyboard.push([{ text: '➕ إضافة كورس جديد', callback_data: 'content_add_course' }]);
  keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }]);
  await setUserState(chatId, null, null);
  await sendMessage(chatId, '🗂️ *إدارة المحتوى: (الكورسات)*\n\nاختر كورساً للتعديل أو أضف كورساً جديداً:', { inline_keyboard: keyboard });
};

const sendContentMenu_Folders = async (chatId, courseId) => {
  const { data: course, error } = await supabase.from('courses').select('title, sections (id, title)').eq('id', courseId).single();
  if (error || !course) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على الكورس.');
    return;
  }
  const courseTitle = escapeMarkdown(course.title);
  const sections = course.sections || [];
  const keyboard = [];
  sections.forEach(section => {
    keyboard.push([{ text: `📁 ${escapeMarkdown(section.title)}`, callback_data: `content_nav_folder_${section.id}`}]);
  });
  keyboard.push([
    { text: '➕ إضافة مجلد', callback_data: `content_add_folder_${courseId}` },
    { text: '❌ حذف مجلد', callback_data: `content_del_folder_${courseId}` }
  ]);
  keyboard.push([{ text: '🗑️ حذف هذا الكورس بالكامل', callback_data: `delete_course_confirm_${courseId}` }]);
  keyboard.push([{ text: '🔙 رجوع (للكورسات)', callback_data: 'admin_manage_content' }]);
  await setUserState(chatId, null, null);
  await sendMessage(chatId, `🗂️ *الكورس: ${courseTitle}*\n\nاختر مجلداً للتعديل أو أضف مجلداً جديداً:`, { inline_keyboard: keyboard });
};

const sendContentMenu_Videos = async (chatId, sectionId) => {
  const { data: section, error } = await supabase.from('sections').select('title, course_id, videos (id, title)').eq('id', sectionId).single();
  if (error || !section) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على المجلد.');
    return;
  }
  const sectionTitle = escapeMarkdown(section.title);
  const courseId = section.course_id;
  const videos = section.videos || [];
  const keyboard = [];
  videos.forEach(video => {
    keyboard.push([{ text: `▶️ ${escapeMarkdown(video.title)}`, callback_data: `content_del_video_${video.id}_${sectionId}`}]);
  });
  if (videos.length === 0) {
      keyboard.push([{ text: '(لا توجد فيديوهات بعد)', callback_data: 'noop' }]);
  }
  keyboard.push([
    { text: '➕ إضافة فيديو', callback_data: `content_add_video_${sectionId}` },
    { text: '❌ حذف فيديو (اضغط عليه فوق)', callback_data: 'noop' }
  ]);
  keyboard.push([{ text: '🔙 رجوع (للمجلدات)', callback_data: `content_nav_course_${courseId}`}]);
  await setUserState(chatId, null, { current_folder_id: sectionId });
  await sendMessage(chatId, `📁 *المجلد: ${sectionTitle}*\n\nاختر فيديو لحذفه أو أضف فيديو جديد:`, { inline_keyboard: keyboard });
};

// --- دوال نظام طلبات الاشتراك ---

const sendSubscriptionCourses = async (chatId) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error || !courses || courses.length === 0) {
    await sendMessage(chatId, 'عذراً، لا توجد كورسات متاحة للاشتراك حالياً.', null, 'MarkdownV2', true);
    return;
  }
  
  // نمرر الاسم (بدون تهريب) في الـ callback data
  const keyboard = courses.map(c => ([{ 
    text: c.title, 
    callback_data: `sub_req_course_${c.id}_${c.title}` 
  }]));
  
  await setUserState(chatId, null, null);
  
  // [ ✅ إصلاح: تم تمرير 'MarkdownV2' بدلاً من null ]
  await sendMessage(chatId, 'اختر الكورس الذي ترغب بالاشتراك به:', { inline_keyboard: keyboard }, 'MarkdownV2', true);
};

const notifyAdminsOfNewRequest = async (request) => {
    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
    if (!admins || admins.length === 0) return;
    let caption = `<b>🔔 طلب اشتراك جديد</b>\n\n` +
                  `<b>المستخدم:</b> ${request.user_name || 'غير متوفر'}\n` +
                  (request.user_username ? `<b>المعرف:</b> @${request.user_username}\n` : '') +
                  `<b>ID:</b> <code>${request.user_id}</code>\n\n` +
                  `<b>الكورس المطلوب:</b>\n${request.course_title}`;
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ منح صلاحية لهذا الكورس', callback_data: `approve_sub_${request.id}` }
      ]]
    };
    for (const admin of admins) {
      await sendPhotoMessage(admin.id, request.payment_file_id, caption, keyboard);
    }
};

const sendPendingRequests = async (chatId) => {
    const { data: requests, error } = await supabase.from('subscription_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (error || !requests || requests.length === 0) {
        await sendMessage(chatId, 'لا توجد طلبات اشتراك معلقة حالياً.');
        return;
    }
    await sendMessage(chatId, `يوجد *${requests.length}* طلب اشتراك معلق:`);
    for (const request of requests) {
        let caption = `<b>🔔 طلب اشتراك معلق</b>\n\n` +
                      `<b>المستخدم:</b> ${request.user_name || 'غير متوفر'}\n` +
                      (request.user_username ? `<b>المعرف:</b> @${request.user_username}\n` : '') +
                      `<b>ID:</b> <code>${request.user_id}</code>\n\n` +
                      `<b>الكورس المطلوب:</b>\n${request.course_title}`;
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ منح صلاحية لهذا الكورس', callback_data: `approve_sub_${request.id}` }
          ]]
        };
        await sendPhotoMessage(chatId, request.payment_file_id, caption, keyboard);
    }
};

// دالة وهمية للأزرار غير القابلة للضغط
const noop = () => {};


// ===============================================
// --- 🚀 الـ Webhook الرئيسي 🚀 ---
// ===============================================
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let user, chatId, userId, text;
  let from; // نحتاج 'from' لبيانات المستخدم

  try {
    const { message, callback_query } = req.body;

    // --- ( 1. معالجة الأزرار - Callback Query) ---
    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id);
      from = callback_query.from; // بيانات مرسل الـ callback
      user = await getUser(userId); // [ ✅ إصلاح: يستخدم admin_state ]
      const command = callback_query.data;
      
      await answerCallbackQuery(callback_query.id);

      if (!user) {
          console.error("User not found on callback:", userId);
          return res.status(200).send('OK');
      }

      if(command === 'noop') return res.status(200).send('OK');

      // --- [ (مسار المستخدم العادي - ضغط الأزرار) ] ---
      if (!user.is_admin) {
        
        if (command.startsWith('sub_req_course_')) {
            const parts = command.split('_');
            const courseId = parseInt(parts[3], 10);
            // استعادة الاسم (قد يحتوي على مسافات '_')
            const courseTitle = command.substring(command.indexOf(parts[4])); 

            await setUserState(userId, 'awaiting_payment_proof', { // [ ✅ إصلاح: يستخدم admin_state ]
                course_id: courseId, 
                course_title: courseTitle 
            });
            
            await sendMessage(
                chatId, 
                `لقد اخترت كورس: *${escapeMarkdown(courseTitle)}*\n\nالرجاء الآن إرسال *صورة واحدة* (Screenshot) تثبت عملية الدفع.`,
                null, 'MarkdownV2', true
            );
            return res.status(200).send('OK');
        }
        
        if (command === 'user_request_subscription') {
            await sendSubscriptionCourses(chatId);
            return res.status(200).send('OK');
        }

        await sendMessage(chatId, 'أنت لست أدمن.', null, 'MarkdownV2', true);
        return res.status(200).send('OK');
      }

      // --- [ (مسار الأدمن - ضغط الأزرار) ] ---
      
      // 1. التنقل الرئيسي للأدمن
      if (command === 'admin_main_menu') {
        await setUserState(userId, null, null);
        await sendAdminMenu(chatId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_users') {
        await setUserState(userId, null, null);
        await sendUserMenu(chatId);
        return res.status(200).send('OK');
      }

      // 2. إدارة المحتوى (التنقل والإضافة)
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
        await setUserState(userId, 'awaiting_course_title');
        await sendMessage(chatId, '📚 أرسل "اسم" الكورس الجديد: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_add_folder_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await setUserState(userId, 'awaiting_folder_title', { course_id: courseId });
        await sendMessage(chatId, '📁 أرسل "اسم" المجلد الجديد: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_add_video_')) {
        const sectionId = parseInt(command.split('_')[3], 10);
        await setUserState(userId, 'awaiting_video_title', { section_id: sectionId });
        await sendMessage(chatId, '🚀 أرسل "عنوان" الفيديو: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }

      // 3. إدارة المحتوى (الحذف)
      if (command.startsWith('content_del_folder_')) {
        await sendMessage(chatId, 'ميزة حذف المجلدات لم تكتمل بعد\\.');
        return res.status(200).send('OK');
      }
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
      
      // 4. إدارة المستخدمين (الأوامر)
      if (command === 'admin_add_users') {
        await setUserState(userId, 'awaiting_user_ids');
        await sendMessage(chatId, '👤 أرسل الآن ID واحد أو أكثر \\(افصل بينهم بمسافة أو سطر جديد\\):');
        return res.status(200).send('OK');
      }
      if (command === 'admin_reset_device') {
        await setUserState(userId, 'awaiting_device_reset_id');
        await sendMessage(chatId, '👤 أرسل ID المستخدم \\(أو عدة IDs\\) الذي تريد حذف بصمته:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_revoke_permissions') {
        await setUserState(userId, 'awaiting_user_id_for_revoke');
        await sendMessage(chatId, '👤 أرسل *ID المستخدم الواحد* الذي تريد مراجعة صلاحياته:');
        return res.status(200).send('OK');
      }
      if (command === 'assign_all_courses') {
        if (!user.admin_state || user.admin_state !== 'awaiting_course_selection' || !user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة\\. يرجى البدء من جديد\\.");
            return res.status(200).send(await setUserState(userId, null, null));
        }
        const usersToUpdate = user.state_data.users;
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: true }));
        const { error } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (error) { /* ... */ } else { await sendMessage(chatId, `✅ تم منح صلاحية كاملة لـ ${usersToUpdate.length} مستخدم\\.`); }
        await setUserState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('assign_course_')) {
         if (!user.admin_state || user.admin_state !== 'awaiting_course_selection' || !user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة\\. يرجى البدء من جديد\\.");
            return res.status(200).send(await setUserState(userId, null, null));
        }
        const courseId = parseInt(command.split('_')[2], 10);
        if (isNaN(courseId)){ /* ... */ }
        const usersToUpdate = user.state_data.users;
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: false }));
        await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        const accessObjects = usersToUpdate.map(uid => ({ user_id: uid, course_id: courseId }));
        await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
        const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
        const courseName = course ? escapeMarkdown(course.title) : 'المحدد';
        await sendMessage(
          chatId,
          `✅ تم إضافة صلاحية كورس *${courseName}*\\.\n اختر كورساً آخر \\(من القائمة السابقة\\) أو اضغط "إنهاء"\\.`,
          { inline_keyboard: [[{ text: '👍 إنهاء', callback_data: 'assign_finish' }]] }
        );
        return res.status(200).send('OK');
      }
      if (command === 'assign_finish') {
         await sendMessage(chatId, `👍 تم حفظ الصلاحيات المحددة للمستخدمين\\.`);
         await setUserState(userId, null, null);
         return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_all_')) {
        const targetUserId = command.split('_')[2];
        await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب "جميع" الصلاحيات من المستخدم \`${targetUserId}\`\\.`);
        await setUserState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_specific_')) {
        const parts = command.split('_');
        const targetUserId = parts[2];
        const courseId = parts[4];
        await supabase.from('user_course_access').delete().match({ user_id: targetUserId, course_id: courseId });
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب صلاحية الكورس\\. جاري تحديث القائمة\\.\\.\\.`);
        await sendRevokeMenu(chatId, targetUserId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('admin_grant_access_')) {
        const targetUserId = command.split('_')[3];
        await setUserState(userId, null, null); 
        await fetchAndSendCoursesMenu(
          chatId,
          `🔑 منح صلاحيات للمستخدم \`${targetUserId}\`\\.\nاختر نوع الصلاحية:`,
          { users: [targetUserId] },
          'assign_course'
        );
        return res.status(200).send('OK');
      }

      // 5. نظام طلبات الاشتراك (جديد)
      if (command === 'admin_view_requests') {
          await sendPendingRequests(chatId);
          return res.status(200).send('OK');
      }
      
      if (command.startsWith('approve_sub_')) {
          const requestId = parseInt(command.split('_')[2], 10);
          const { data: request, error: reqError } = await supabase.from('subscription_requests').select('*').eq('id', requestId).single();
          if (reqError || !request) {
              await sendMessage(chatId, 'خطأ: لم يتم العثور على هذا الطلب.');
              return res.status(200).send('OK');
          }
          if (request.status === 'approved') {
              await sendMessage(chatId, 'تمت الموافقة على هذا الطلب مسبقاً.');
              return res.status(200).send('OK');
          }
          const targetUserId = request.user_id;
          const courseId = request.course_id;
          const courseTitle = escapeMarkdown(request.course_title);
          
          await supabase.from('user_course_access').upsert({ user_id: targetUserId, course_id: courseId });
          await supabase.from('users').upsert({ id: targetUserId, is_subscribed: false }); 
          await supabase.from('subscription_requests').update({ status: 'approved' }).eq('id', requestId);

          const userMessage = `🎉 *تهانينا، تمت الموافقة على اشتراكك!*\n\n` +
                              `تم تفعيل اشتراكك في كورس: *${courseTitle}*\n\n` +
                              `*هام جداً:*\n` +
                              `هذا هو ID الخاص بك، استخدمه لتسجيل الدخول في التطبيق:\n` +
                              `\`${targetUserId}\``;
          await sendMessage(targetUserId, userMessage, null, 'MarkdownV2', true); // حماية هذه الرسالة

          const adminName = from.first_name || 'Admin';
          const newCaption = callback_query.message.caption + `\n\n<b>✅ تمت الموافقة بواسطة:</b> ${adminName}`;
          try {
              await axios.post(`${TELEGRAM_API}/editMessageCaption`, {
                    chat_id: chatId,
                    message_id: callback_query.message.message_id,
                    caption: newCaption,
                    parse_mode: 'HTML',
                    reply_markup: null // إزالة الأزرار
              });
          } catch(e) {
              await sendMessage(chatId, `✅ تم منح الصلاحية للمستخدم \`${targetUserId}\` بنجاح.`);
          }
          return res.status(200).send('OK');
      }

      console.warn("Unhandled callback query:", command);
      return res.status(200).send('OK');
    }

    // --- ( 2. معالجة الرسائل النصية والصور) ---
    if (message && message.from) {
      chatId = message.chat.id;
      userId = String(message.from.id);
      text = message.text;
      from = message.from; 
      user = await getUser(userId); // [ ✅ إصلاح: يستخدم admin_state ]

      if (!user) {
          console.error("User not found on message:", userId);
          return res.status(200).send('OK');
      }

      // أمر /start
      if (text === '/start') {
        if (user.is_admin) {
          await sendAdminMenu(chatId); // الأدمن يرى قائمة الأدمن
        } else {
           const { count, error: accessCheckError } = await supabase.from('user_course_access').select('*', { count: 'exact', head: true }).eq('user_id', userId);
           if (accessCheckError && accessCheckError.code !== 'PGRST116') {
                await sendMessage(chatId, "حدث خطأ أثناء التحقق من صلاحياتك\\.", null, 'MarkdownV2', true);
                return res.status(200).send('OK');
           }
          const hasSpecificAccess = count > 0;
          if (user.is_subscribed || hasSpecificAccess) {
            await sendMessage(chatId, 'أهلاً بك! اضغط على زر القائمة في الأسفل لبدء الكورسات\\.', null, 'MarkdownV2', true);
          } else {
            // المستخدم الجديد يرى زر طلب الاشتراك
            const keyboard = { inline_keyboard: [[ { text: '📋 طلب اشتراك', callback_data: 'user_request_subscription' } ]] };
            await sendMessage(chatId, 'أنت غير مشترك في الخدمة\\. يمكنك طلب اشتراك من الزر أدناه\\.', keyboard, 'MarkdownV2', true);
          }
        }
        return res.status(200).send('OK');
      }

      // أمر /cancel
      if (text === '/cancel') {
         await setUserState(userId, null, null);
         await sendMessage(chatId, '👍 تم إلغاء العملية\\.', null, 'MarkdownV2', true);
         return res.status(200).send('OK');
      }

      // --- [ معالجة الحالات (State Machine) ] ---
      
      // [ ✅ إصلاح: التحقق من 'admin_state' ]
      const currentState = user.admin_state; 

      // (1. حالات المستخدم العادي - إرسال صورة)
      if (!user.is_admin && currentState === 'awaiting_payment_proof') {
        if (!message.photo) {
            await sendMessage(chatId, 'الرجاء إرسال *صورة* فقط (Screenshot) كإثبات. أعد المحاولة أو اضغط /cancel', null, 'MarkdownV2', true);
            return res.status(200).send('OK');
        }
        
        const stateData = user.state_data;
        if (!stateData || !stateData.course_id || !stateData.course_title) {
            await sendMessage(chatId, 'حدث خطأ. بيانات الكورس مفقودة. ابدأ من جديد بالضغط على /start', null, 'MarkdownV2', true);
            await setUserState(userId, null, null);
            return res.status(200).send('OK');
        }
        
        const payment_file_id = message.photo[message.photo.length - 1].file_id;
        const user_name = `${from.first_name || ''} ${from.last_name || ''}`.trim();
        const user_username = from.username || null;
        
        const { data: newRequest, error: insertError } = await supabase
            .from('subscription_requests')
            .insert({
                user_id: userId,
                user_name: user_name,
                user_username: user_username,
                course_id: stateData.course_id,
                course_title: stateData.course_title,
                payment_file_id: payment_file_id,
                status: 'pending'
            })
            .select()
            .single();

        if (insertError) {
            await sendMessage(chatId, `حدث خطأ أثناء حفظ طلبك: ${insertError.message}`, null, 'MarkdownV2', true);
            return res.status(200).send('OK');
        }
        await sendMessage(chatId, '✅ تم استلام طلبك بنجاح. سيقوم الأدمن بمراجعته والرد عليك قريباً.', null, 'MarkdownV2', true);
        await notifyAdminsOfNewRequest(newRequest);
        await setUserState(userId, null, null);
        
        return res.status(200).send('OK');
      }

      // (2. حالات الأدمن - إدخال نصي)
      if (user.is_admin && currentState) {
        switch (currentState) {

          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await sendMessage(chatId, 'خطأ\\. أرسل IDs صالحة\\. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            await fetchAndSendCoursesMenu(chatId, `تم تحديد ${ids.length} مستخدم\\. اختر نوع الصلاحية:`, { users: ids }, 'assign_course');
            break;
          case 'awaiting_device_reset_id':
            const resetIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (resetIds.length === 0) {
                await sendMessage(chatId, 'خطأ\\. أرسل IDs صالحة\\. حاول مجدداً أو اضغط /cancel');
                return res.status(200).send('OK');
            }
            const { error: deleteError } = await supabase.from('devices').delete().in('user_id', resetIds);
            if (deleteError) { await sendMessage(chatId, `حدث خطأ: ${escapeMarkdown(deleteError.message)}`); } 
            else { await sendMessage(chatId, `✅ تم حذف البصمات لـ ${resetIds.length} مستخدم\\.`); }
            await setUserState(userId, null, null);
            break;
          case 'awaiting_user_id_for_revoke':
            const revokeIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (revokeIds.length !== 1) {
                 await sendMessage(chatId, 'خطأ\\. هذه الميزة تعمل لمستخدم واحد فقط\\. أرسل ID واحد\\.');
                 return res.status(200).send('OK');
            }
            const targetUserId = revokeIds[0];
            await setUserState(userId, null, null);
            await sendRevokeMenu(chatId, targetUserId);
            break;

          // (حالات إدارة المحتوى)
          case 'awaiting_course_title':
            await supabase.from('courses').insert({ title: text });
            await sendMessage(chatId, `✅ تم إضافة الكورس "${escapeMarkdown(text)}" بنجاح\\.`);
            await setUserState(userId, null, null);
            await sendContentMenu_Courses(chatId); // تحديث القائمة
            break;
          case 'awaiting_folder_title':
            if (!user.state_data || !user.state_data.course_id) {
               await sendMessage(chatId, "خطأ: بيانات الكورس مفقودة\\. أعد المحاولة\\.");
               await setUserState(userId, null, null);
               break;
            }
            await supabase.from('sections').insert({ title: text, course_id: user.state_data.course_id });
            await sendMessage(chatId, `✅ تم إضافة المجلد "${escapeMarkdown(text)}" بنجاح\\.`);
            await sendContentMenu_Folders(chatId, user.state_data.course_id); // تحديث القائمة
            break;
          case 'awaiting_video_title':
            if (!user.state_data || !user.state_data.section_id) {
               await sendMessage(chatId, "خطأ: بيانات المجلد مفقودة\\. أعد المحاولة\\.");
               await setUserState(userId, null, null);
               break;
            }
            await setUserState(userId, 'awaiting_youtube_id', { 
                section_id: user.state_data.section_id, 
                video_title: text 
            });
            await sendMessage(chatId, `👍 العنوان: "${escapeMarkdown(text)}"\n\nالآن أرسل "رابط يوتيوب" الخاص بالفيديو:`);
            break;
          case 'awaiting_youtube_id':
            if (!user.state_data || !user.state_data.section_id || !user.state_data.video_title) {
               await sendMessage(chatId, "خطأ: الحالة مفقودة. أعد المحاولة.");
               await setUserState(userId, null, null);
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
                section_id: user.state_data.section_id
            });
            await sendMessage(chatId, '✅✅✅ تم إضافة الفيديو بنجاح!');
            await sendContentMenu_Videos(chatId, user.state_data.section_id); // تحديث القائمة
            break;
            
        } // نهاية الـ switch
        return res.status(200).send('OK');
      }

      // رسالة عامة (إذا لم يكن في أي حالة)
      if (!currentState) {
        await sendMessage(chatId, 'الأمر غير معروف\\. اضغط /start', null, 'MarkdownV2', true);
      }
    }

  } catch (e) {
    console.error("Error in webhook:", e);
    if (chatId) {
        try {
           await sendMessage(chatId, `حدث خطأ جسيم في الخادم: ${escapeMarkdown(e.message)}`, null, 'MarkdownV2', true);
        } catch (sendError) {
             console.error("Failed to send critical error message:", sendError);
        }
    }
  }

  res.status(200).send('OK');
};
