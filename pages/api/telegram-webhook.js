// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

// --- [ المتغيرات الأساسية ] ---
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID; // (للتحكم فيمن يضيف المشرفين)

// --- [ (1) دوال المساعدة الأساسية ] ---

/**
 * [ ✅ إصلاح 2: إضافة دالة تهيئة الماركداون ]
 * هذه الدالة تهيئ النص ليتم عرضه بأمان في وضع MarkdownV2
 */
const escapeMarkdownV2 = (text) => {
  if (text === null || typeof text === 'undefined') return '';
  const str = String(text);
  // (هذه قائمة بكل الحروف الخاصة في تليجرام)
  return str.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
};

/**
 * دالة إرسال الرسائل الرئيسية
 */

/**
 * دالة إرسال الصورة (للأدمن)
 */
const sendPhotoMessage = async (chatId, photo_file_id, caption, reply_markup = null) => {
    try {
        await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: photo_file_id,
            caption: caption,
            parse_mode: 'HTML',
            ...(reply_markup && { reply_markup }),
            protect_content: false 
        });
    } catch (error) {
         console.error(`Failed to send photo to chat ${chatId}:`, error.response?.data || error.message);
    }
};

const sendMessage = async (chatId, text, reply_markup = null, parse_mode = null, protect_content = false) => {
    if (!text || text.trim() === '') {
        console.warn(`Attempted to send empty message to chat ID: ${chatId}`);
        return null;
    }
    
    const processedText = (parse_mode === 'MarkdownV2') ? escapeMarkdownV2(text) : text;
    
    const payload = {
        chat_id: chatId,
        text: processedText,
        protect_content: protect_content // (الافتراضي false)
    };
    
    if (reply_markup) payload.reply_markup = reply_markup;
    if (parse_mode) payload.parse_mode = parse_mode;
    
    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
        return response;
    } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error.response?.data || error.message);
        
        if (error.response && error.response.data && error.response.data.description.includes("can't parse entities")) {
            console.warn(`Markdown parsing failed for chat ${chatId}. Resending as plain text.`);
            const retryPayload = { ...payload, text: text };
            delete retryPayload.parse_mode;
            try {
                return await axios.post(`${TELEGRAM_API}/sendMessage`, retryPayload);
            } catch (retryError) {
                console.error(`Failed to resend plain text message to chat ${chatId}:`, retryError.response?.data || retryError.message);
            }
        }
        return null;
    }
};
/**
 * دالة الرد على Callback Query
 */
const answerCallbackQuery = async (callbackQueryId, options = {}) => {
  try {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      ...options
    });
  } catch (e) {
      console.error("Failed to answer callback query:", e.message);
  }
};

/**
 * دالة تعديل الرسائل
 */


/**
 * دالة تعديل الأزرار فقط
 */
const editMarkup = async (chatId, messageId, reply_markup = null) => {
     try {
        await axios.post(`${TELEGRAM_API}/editMessageReplyMarkup`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: reply_markup
        });
    } catch (e) {
         // (تجاهل الأخطاء)
    }
};

const editMessage = async (chatId, messageId, text, reply_markup = null, parse_mode = null) => {
    if (!text || text.trim() === '') {
        console.warn(`Attempted to edit to empty message: ${chatId}:${messageId}`);
        return;
    }
    
    const processedText = (parse_mode === 'MarkdownV2') ? escapeMarkdownV2(text) : text;

    const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: processedText,
    };
    
    if (reply_markup) payload.reply_markup = reply_markup;
    if (parse_mode) payload.parse_mode = parse_mode;
    
    try {
        await axios.post(`${TELEGRAM_API}/editMessageText`, payload);
    } catch (error) {
        if (error.response && error.response.data && error.response.data.description.includes("message is not modified")) {
            // (لا مشكلة)
        } else if (error.response && error.response.data && error.response.data.description.includes("can't parse entities")) {
             console.error(`Markdown parsing failed for editMessage ${chatId}:${messageId}. Resending as plain text.`);
             const retryPayload = { ...payload, text: text };
             delete retryPayload.parse_mode;
             try {
                await axios.post(`${TELEGRAM_API}/editMessageText`, retryPayload);
             } catch (retryError) {
                 console.error(`Failed to resend plain text editMessage to ${chatId}:${messageId}:`, retryError.response?.data || retryError.message);
             }
        } else {
             console.error(`Failed to edit message ${chatId}:${messageId}:`, error.response?.data || error.message);
        }
    }
};
/**
 * دالة بناء الأزرار
 */
const buildKeyboard = (items, prefix, columns = 1) => {
    const keyboard = [];
    let row = [];
    items.forEach(item => {
        row.push({ text: item.text, callback_data: `${prefix}${item.id}` });
        if (row.length >= columns) {
            keyboard.push(row);
            row = [];
        }
    });
    if (row.length > 0) keyboard.push(row);
    return keyboard;
};

/**
 * دالة جلب ID يوتيوب
 */
const getYouTubeID = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=|\?v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) return match[2];
  if (url.length === 11) return url;
  return null;
};

/**
 * دالة وهمية
 */
const noop = () => {};


// --- [ (2) دوال إدارة قواعد البيانات (المستخدم والحالة) ] ---

/**
 * جلب المستخدم أو إنشاؤه
 */
const getUser = async (userId) => {
  const selectQuery = 'id, is_admin, admin_state, state_data'; // (تم حذف is_subscribed)
  let userData = null;
  try {
      const { data, error } = await supabase.from('users').select(selectQuery).eq('id', userId).single();
      if (error && error.code === 'PGRST116') {
          const newUser = { id: userId, is_admin: false };
          const { data: insertedUser, error: insertError } = await supabase.from('users').insert(newUser).select(selectQuery).single();
          if (insertError) {
              console.error(`Error inserting user ${userId}:`, insertError);
              return { id: userId, is_admin: false };
          }
          userData = insertedUser;
      } else if (error) {
          console.error(`Error fetching user ${userId}:`, error); 
          return { id: userId, is_admin: false };
      } else {
          userData = data;
      }
  } catch (catchError) {
      console.error(`Unexpected error in getUser for ${userId}:`, catchError);
      return { id: userId, is_admin: false };
  }
  return userData || { id: userId, is_admin: false };
};

/**
 * تعيين حالة المستخدم (للتفاعلات متعددة الخطوات)
 */
const setUserState = async (userId, state, data = null) => {
  try {
    await supabase.from('users').update({ admin_state: state, state_data: data }).eq('id', userId);
  } catch(e) {
      console.error("Failed to set user state:", e.message);
  }
};


// --- [ (3) دوال الأدمن: القوائم الرئيسية والإشراف ] ---

const sendAdminMenu = async (chatId, user, messageId = null) => {
  await setUserState(user.id, null, null);
  const keyboard = {
    inline_keyboard: [
      [{ text: '👑 الإشراف', callback_data: 'admin_supervision' }],
      [{ text: '📨 طلبات الاشتراك', callback_data: 'admin_view_requests' }],
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '🗂️ إدارة المحتوى', callback_data: 'admin_manage_content' }],
    ],
  };
  
  const text = 'Panel Admin:\nاختر القسم:';
  if (messageId) {
      await editMessage(chatId, messageId, text, keyboard);
  } else {
      await sendMessage(chatId, text, keyboard);
  }
};

const sendUserMenu = async (chatId, messageId) => {
  await setUserState(chatId, null, null);
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة/تحديث مستخدمين', callback_data: 'admin_add_users' }],
      [{ text: '❌ سحب الصلاحيات', callback_data: 'admin_revoke_permissions' }],
      [{ text: '🔄 إعادة تعيين جهاز (حذف البصمة)', callback_data: 'admin_reset_device' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  await editMessage(chatId, messageId, 'إدارة المستخدمين:', keyboard);
};

const sendSupervisionMenu = async (chatId, user, messageId) => {
   await setUserState(user.id, null, null);
   const keyboard = {
    inline_keyboard: [
      [{ text: '📊 الإحصائيات', callback_data: 'admin_stats' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  
  if (MAIN_ADMIN_ID && String(user.id) === MAIN_ADMIN_ID) {
    keyboard.inline_keyboard.splice(1, 0, [
      { text: '👮‍♂️ تعديل المشرفين', callback_data: 'admin_manage_admins' }
    ]);
  }
  await editMessage(chatId, messageId, 'قسم الإشراف:', keyboard);
};

const sendAdminManagementMenu = async (chatId, messageId) => {
    await setUserState(chatId, null, null);
    let message = 'إدارة المشرفين:\n\n';
    try {
        const { data: admins, error } = await supabase
            .from('users').select('id').eq('is_admin', true).order('id');
        if (error) throw error;

        if (admins && admins.length > 0) {
            message += '👮‍♂️ المشرفون الحاليون (جاري جلب الأسماء...):\n';
            
            const adminInfoPromises = admins.map(async (admin) => {
                let adminInfo = `- <code>${admin.id}</code>`;
                try {
                    const response = await axios.post(`${TELEGRAM_API}/getChat`, { chat_id: admin.id });
                    const chat = response.data.result;
                    let name = chat.first_name || '';
                    if (chat.last_name) name += ` ${chat.last_name}`;
                    if (chat.username) name += ` (@${chat.username})`;
                    if (name.trim()) adminInfo += ` (${name.trim()})`;
                } catch (e) { /* تجاهل الفشل */ }
                if (String(admin.id) === MAIN_ADMIN_ID) adminInfo += ` (👑 الأدمن الرئيسي)`;
                return adminInfo;
            });
            const adminInfoStrings = await Promise.all(adminInfoPromises);
            message = 'إدارة المشرفين:\n\n👮‍♂️ المشرفون الحاليون:\n';
            message += adminInfoStrings.join('\n');
        } else {
            message += '(لا يوجد مشرفون حالياً)\n';
        }
    } catch (error) {
        message += 'حدث خطأ أثناء جلب قائمة المشرفين.\n';
    }

   const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة مشرف جديد', callback_data: 'admin_add_admin' }],
      [{ text: '➖ إزالة مشرف', callback_data: 'admin_remove_admin' }],
      [{ text: '🔙 رجوع (للإشراف)', callback_data: 'admin_supervision' }],
    ],
  };
  
  await editMessage(chatId, messageId, message, keyboard, 'HTML');
};

/**
 * [ ✅✅ تعديل: دالة جلب وعرض الإحصائيات (بالنظام الجديد) ]
 */

/**
 * [ ✅✅ تعديل: دالة جلب وعرض الإحصائيات (مع أزرار الرجوع) ]
 */
const sendStatistics = async (chatId, messageId) => {
    try {
        await editMessage(chatId, messageId, '📊 جاري حساب الإحصائيات الجديدة، يرجى الانتظار...');

        // ... (كل كود حساب الإحصائيات يبقى كما هو) ...
        // 1. إجمالي المستخدمين
        const { count: totalUsers, error: totalError } = await supabase
            .from('users').select('*', { count: 'exact', head: true });
        if (totalError) throw new Error(`Total Users Error: ${totalError.message}`);

        // 2. إجمالي المشرفين
        const { count: totalAdmins, error: adminError } = await supabase
            .from('users').select('*', { count: 'exact', head: true }).eq('is_admin', true);
        if (adminError) throw new Error(`Total Admins Error: ${adminError.message}`);

        // --- [ إحصائيات المحتوى ] ---
        const { count: totalCourses, error: cErr } = await supabase.from('courses').select('*', { count: 'exact', head: true });
        const { count: totalSubjects, error: sErr } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
        const { count: totalChapters, error: chErr } = await supabase.from('chapters').select('*', { count: 'exact', head: true });
        const { count: totalVideos, error: vErr } = await supabase.from('videos').select('*', { count: 'exact', head: true });
        if (cErr || sErr || chErr || vErr) console.error("Content stats error (non-critical)");

        // --- [ إحصائيات الصلاحيات (الجديدة) ] ---
        const { data: fullCourseSubs, error: fullSubError } = await supabase
            .from('user_course_access')
            .select('courses ( title )');
        if (fullSubError) throw new Error(`Full Course Subs Error: ${fullSubError.message}`);
        
        const { data: specificSubs, error: specificSubError } = await supabase
            .from('user_subject_access')
            .select('subjects ( title )');
        if (specificSubError) throw new Error(`Specific Subs Error: ${specificSubError.message}`);

        const courseCounts = {};
        let totalFullCoursePerms = 0;
        if (fullCourseSubs) {
            totalFullCoursePerms = fullCourseSubs.length;
            fullCourseSubs.forEach(sub => {
                const title = sub.courses ? sub.courses.title : 'كورس محذوف';
                courseCounts[title] = (courseCounts[title] || 0) + 1;
            });
        }
        
        const subjectCounts = {};
        let totalSpecificSubjectPerms = 0;
        if (specificSubs) {
            totalSpecificSubjectPerms = specificSubs.length;
            specificSubs.forEach(sub => {
                const title = sub.subjects ? sub.subjects.title : 'مادة محذوفة';
                subjectCounts[title] = (subjectCounts[title] || 0) + 1;
            });
        }

        // 5. بناء الرسالة
        let message = `📊 إحصائيات البوت (النظام الجديد):\n\n`;
        message += `👤 إجمالي المستخدمين: ${totalUsers}\n`;
        message += `👮‍♂️ إجمالي المشرفين: ${totalAdmins}\n\n`;
        message += `--- [ 🗂️ المحتوى ] ---\n`;
        message += `📚 الكورسات: ${totalCourses || 0}\n`;
        message += `📖 المواد: ${totalSubjects || 0}\n`;
        message += `📁 الشباتر: ${totalChapters || 0}\n`;
        message += `▶️ الفيديوهات: ${totalVideos || 0}\n\n`;
        message += `--- [ 🔑 الصلاحيات الممنوحة ] ---\n`;
        message += `💎 (صلاحيات الكورسات الكاملة): ${totalFullCoursePerms} صلاحية\n`;
        if (Object.keys(courseCounts).length > 0) {
            for (const [title, count] of Object.entries(courseCounts)) {
                message += `  - ${title}: ${count} مشترك\n`;
            }
        }
        message += `\n🔒 (صلاحيات المواد المحددة): ${totalSpecificSubjectPerms} صلاحية\n`;
        if (Object.keys(subjectCounts).length > 0) {
            for (const [title, count] of Object.entries(subjectCounts)) {
                message += `  - ${title}: ${count} مشترك\n`;
            }
        }
        if (totalFullCoursePerms === 0 && totalSpecificSubjectPerms === 0) {
             message += `(لا توجد أي صلاحيات ممنوحة حالياً)\n`;
        }

        // [ ✅✅ تعديل: إضافة أزرار الرجوع هنا ]
        const kbd = { inline_keyboard: [
            [
                { text: '🔙 رجوع (للإشراف)', callback_data: 'admin_supervision' },
                { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
            ]
        ]};

        await editMessage(chatId, messageId, message, kbd);

    } catch (error) {
        console.error("Error in sendStatistics:", error);
        await editMessage(chatId, messageId, `حدث خطأ أثناء جلب الإحصائيات: ${error.message}`);
    }
};
// --- [ (4) دوال الأدمن: إدارة المحتوى (الهيكل الجديد) ] ---

// (المستوى 1: الكورسات)
const sendContentMenu_Courses = async (chatId, messageId = null) => {
  await setUserState(chatId, null, null);
  const { data: courses, error } = await supabase.from('courses').select('id, title, sort_order').order('sort_order');
  if (error) return await sendMessage(chatId, `خطأ: ${error.message}`);
  
  const keyboard = buildKeyboard(courses.map(c => ({ id: c.id, text: `📚 ${c.title}` })), 'content_nav_course_');
  keyboard.push([{ text: '➕ إضافة كورس', callback_data: 'content_add_course' }]);
  keyboard.push([{ text: '🔃 ترتيب الكورسات', callback_data: 'content_order_start_courses' }]);
  keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }]);
  
  const text = 'إدارة المحتوى: (الكورسات)\nاختر كورساً:';
  
  if (messageId) {
    await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
  } else {
    await sendMessage(chatId, text, { inline_keyboard: keyboard });
  }
};

// (المستوى 2: المواد)
// (المستوى 2: المواد - [ ✅ تعديل: إضافة زر "تعديل الكورس" ])
const sendContentMenu_Subjects = async (chatId, messageId, courseId) => {
  await setUserState(chatId, null, { current_course_id: courseId });
  const { data: course, error } = await supabase.from('courses').select('title, price').eq('id', courseId).single();
  const { data: subjects, error: subError } = await supabase.from('subjects').select('id, title, sort_order').eq('course_id', courseId).order('sort_order');
  if (error || subError) return await editMessage(chatId, messageId, `خطأ: ${error?.message || subError?.message}`);
  if (!course) return await editMessage(chatId, messageId, 'خطأ: الكورس غير موجود.', { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_manage_content' }]] });

  const keyboard = buildKeyboard(subjects.map(s => ({ id: s.id, text: `📖 ${s.title}` })), 'content_nav_subject_');
  keyboard.push([
      { text: '➕ إضافة مادة', callback_data: `content_add_subject_${courseId}` },
      { text: '❌ حذف مادة', callback_data: `content_del_subject_picker_${courseId}` }
  ]);
  keyboard.push([{ text: '🔃 ترتيب المواد', callback_data: `content_order_start_subjects_${courseId}` }]);
  
  // [ ✅ جديد: زر تعديل الكورس (السعر) ]
  keyboard.push([{ text: `✏️ تعديل سعر الكورس (الحالي: ${course.price || 0} ج)`, callback_data: `content_edit_course_price_${courseId}` }]);
  
  keyboard.push([{ text: '🗑️ حذف الكورس كاملاً', callback_data: `delete_course_confirm_${courseId}` }]);
  // [ ✅ تعديل: إضافة زر الرئيسية ]
  keyboard.push([
      { text: '🔙 رجوع (للكورسات)', callback_data: 'admin_manage_content' },
      { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
  ]);

  const text = `الكورس: ${course.title}\n\nاختر مادة:`;
  await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
};

// (المستوى 3: الشباتر - [ ✅ تعديل: إضافة زر "تعديل المادة" ])
const sendContentMenu_Chapters = async (chatId, messageId, subjectId) => {
  await setUserState(chatId, null, { current_subject_id: subjectId });
  const { data: subject, error } = await supabase.from('subjects').select('title, course_id, price').eq('id', subjectId).single();
  const { data: chapters, error: chError } = await supabase.from('chapters').select('id, title, sort_order').eq('subject_id', subjectId).order('sort_order');
  if (error || chError) return await editMessage(chatId, messageId, `خطأ: ${error?.message || chError?.message}`);
  if (!subject) return await editMessage(chatId, messageId, 'خطأ: المادة غير موجودة.', { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_manage_content' }]] });

  const keyboard = buildKeyboard(chapters.map(c => ({ id: c.id, text: `📁 ${c.title}` })), 'content_nav_chapter_');
  keyboard.push([
      { text: '➕ إضافة شابتر', callback_data: `content_add_chapter_${subjectId}` },
      { text: '❌ حذف شابتر', callback_data: `content_del_chapter_picker_${subjectId}` }
  ]);
  keyboard.push([{ text: '🔃 ترتيب الشباتر', callback_data: `content_order_start_chapters_${subjectId}` }]);

  // [ ✅ جديد: زر تعديل المادة (السعر) ]
  keyboard.push([{ text: `✏️ تعديل سعر المادة (الحالي: ${subject.price || 0} ج)`, callback_data: `content_edit_subject_price_${subjectId}` }]);

  keyboard.push([{ text: '🗑️ حذف المادة كاملة', callback_data: `delete_subject_confirm_${subject.course_id}_${subjectId}` }]);
  // [ ✅ تعديل: إضافة زر الرئيسية ]
  keyboard.push([
      { text: '🔙 رجوع (للمواد)', callback_data: `content_nav_course_${subject.course_id}` },
      { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
  ]);
  const text = `المادة: ${subject.title}\n\nاختر شابتر:`;
  await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
};
// (المستوى 4: الفيديوهات)
// (المستوى 4: الفيديوهات)
const sendContentMenu_Videos = async (chatId, messageId, chapterId) => {
  await setUserState(chatId, null, { current_chapter_id: chapterId });
  const { data: chapter, error } = await supabase.from('chapters').select('title, subject_id').eq('id', chapterId).single();
  const { data: videos, error: vError } = await supabase.from('videos').select('id, title, sort_order').eq('chapter_id', chapterId).order('sort_order');
  if (error || vError) return await editMessage(chatId, messageId, `خطأ: ${error?.message || vError?.message}`);
  if (!chapter) return await editMessage(chatId, messageId, 'خطأ: الشابتر غير موجود.', { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_manage_content' }]] });

  // (الضغط على الفيديو يحذفه - هذا صحيح: chapterId_videoId)
  const keyboard = buildKeyboard(videos.map(v => ({ id: v.id, text: `▶️ ${v.title}` })), `content_del_video_confirm_${chapterId}_`); 
  
  if (videos.length === 0) keyboard.push([{ text: '(لا توجد فيديوهات)', callback_data: 'noop' }]);
  
  keyboard.push([
      { text: '➕ إضافة فيديو', callback_data: `content_add_video_${chapterId}` },
      { text: '❌ حذف فيديو (اضغط عليه فوق)', callback_data: 'noop' }
  ]);
  keyboard.push([{ text: '🔃 ترتيب الفيديوهات', callback_data: `content_order_start_videos_${chapterId}` }]);
  // [ ✅✅ إصلاح 1: إضافة subject_id هنا ]
  keyboard.push([{ text: '🗑️ حذف الشابتر كاملاً', callback_data: `delete_chapter_confirm_${chapter.subject_id}_${chapterId}` }]);
  // [ ✅ تعديل: إضافة زر الرئيسية ]
  keyboard.push([
      { text: '🔙 رجوع (للشباتر)', callback_data: `content_nav_subject_${chapter.subject_id}` },
      { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
  ]);
  const text = `الشابتر: ${chapter.title}\n\nاختر فيديو لحذفه أو أضف جديد:`;
  await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
};

// --- [ دوال الحذف والترتيب (الجديدة) ] ---

// --- [ دوال الحذف والترتيب (الجديدة) ] ---

// (دالة عامة لاختيار عنصر لحذفه)
const sendDeletionPicker = async (chatId, messageId, items, nav_callback, delete_prefix) => {
    if (!items || items.length === 0) {
        await editMessage(chatId, messageId, 'لا توجد عناصر لحذفها.', { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: nav_callback }]] });
        return;
    }
    // [ ✅✅ إصلاح 1: تمرير delete_prefix كاملاً (الذي يحتوي الآن على parentId) ]
    const keyboard = buildKeyboard(items.map(i => ({ id: i.id, text: `🗑️ ${i.title}` })), delete_prefix);
    // [ ✅ تعديل: إضافة زر الرئيسية ]
  keyboard.push([
      { text: '🔙 رجوع (إلغاء)', callback_data: nav_callback },
      { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
  ]);
    await editMessage(chatId, messageId, 'اختر العنصر الذي تريد حذفه (سيتم حذف كل ما بداخله):', { inline_keyboard: keyboard });
};


/**
 * [ ✅✅ إصلاح: دالة الترتيب المعدلة ]
 * (دالة عامة للترتيب)
 */
const sendOrderingMenu = async (chatId, messageId, itemType, items, nav_callback) => {
    await setUserState(chatId, 'awaiting_sort_order', {
        message_id: messageId,
        item_type: itemType, // 'courses', 'subjects', 'chapters', 'videos'
        items: items, // (قائمة العناصر الحالية)
        nav_callback: nav_callback
    });
    
    let text = `🔃 ترتيب ${itemType}:\n\n`;
    if (items.length === 0) {
        text += '(لا توجد عناصر لترتيبها)';
    } else {
        items.forEach((item, index) => {
            // [ ✅✅ الإصلاح هنا: تهيئة العنوان قبل إضافته للنص ]
            // (هذا يمنع خطأ "can't parse entities")
            const safeTitle = escapeMarkdownV2(item.title);
            text += `${index + 1}. ${safeTitle} (ID: ${item.id} | الترتيب: ${item.sort_order || 0})\n`;
        });
    }
    text += '\nأرسل الترتيب الجديد في رسالة واحدة، كل عنصر في سطر، بالشكل التالي:\n`ID,رقم_الترتيب`\n\nمثال:\n`12,10`\n`15,20`\n`11,30`\n\n(أو /cancel للإلغاء)';
    
    // [ ✅✅ تعديل: إضافة أزرار الرجوع والمنزل الثابتة ]
    const kbd = { inline_keyboard: [
        [
            { text: '🔙 رجوع (إلغاء)', callback_data: nav_callback },
            { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
        ]
    ]};
    
    // (الدالة editMessage نفسها ستقوم بتهيئة النص كاملاً)
    await editMessage(chatId, messageId, text, kbd, 'MarkdownV2');
};

// --- [ (5) دوال الأدمن: إدارة المستخدمين (الجديدة) ] ---
// [ ✅✅ تعديل: دالة سحب الصلاحيات (الجديدة والمعدلة) ]
// (هذه الدالة تقوم الآن بفلترة المواد المكررة)
const sendRevokeMenu = async (adminChatId, targetUserId, messageId) => {
  try {
    await setUserState(adminChatId, null, null); // (تنظيف الحالة)
    
    // 1. التحقق من وجود المستخدم
    const { data: targetUser, error: userCheck } = await supabase.from('users').select('id').eq('id', targetUserId).single();
    if (userCheck || !targetUser) {
        await editMessage(adminChatId, messageId, `خطأ: المستخدم ${targetUserId} غير موجود. اطلب منه تشغيل البوت أولاً.`);
        return;
    }
    
    // --- [ ✅ التعديل يبدأ هنا ] ---

    // 2. جلب الكورسات الكاملة وتخزين IDs
    const { data: courseAccess, error: cErr } = await supabase
        .from('user_course_access')
        .select('courses ( id, title )') // (نحتاج id و title)
        .eq('user_id', targetUserId);
        
    // 3. جلب المواد المحددة (مع course_id الخاص بها)
    const { data: subjectAccess, error: sErr } = await supabase
        .from('user_subject_access')
        .select('subjects ( id, title, course_id )') // (نحتاج course_id للفلترة)
        .eq('user_id', targetUserId);

    if (cErr || sErr) throw new Error(cErr?.message || sErr?.message);

    // (مجموعة لتخزين IDs الكورسات الكاملة لسهولة البحث)
    const fullCourseIds = new Set();

    let message = `مراجعة صلاحيات المستخدم: ${targetUserId}\n\n`;
    const keyboard = [];

    // 4. عرض الكورسات الكاملة (وتسجيل IDs)
    if (courseAccess && courseAccess.length > 0) {
        message += "💎 الكورسات الكاملة:\n";
        courseAccess.forEach(access => {
            if (access.courses) {
                message += `- ${access.courses.title}\n`;
                keyboard.push([{ text: `❌ سحب [كورس ${access.courses.title}]`, callback_data: `revoke_full_course_${targetUserId}_${access.courses.id}`}]);
                fullCourseIds.add(access.courses.id); // (تسجيل الـ ID للفلترة)
            }
        });
    }
    
    // 5. فلترة المواد المحددة (لإزالة التكرار)
    const filteredSubjectAccess = subjectAccess ? subjectAccess.filter(access => {
        if (!access.subjects) return false; // (إذا كانت المادة محذوفة)
        // (الشرط: اعرض المادة فقط إذا كان الكورس التابعة له "غير" موجود في قائمة الكورسات الكاملة)
        return !fullCourseIds.has(access.subjects.course_id);
    }) : [];
    
    // 6. عرض المواد المحددة (المفلترة)
    if (filteredSubjectAccess.length > 0) {
        message += "\n🔒 المواد المحددة (التي ليست ضمن كورس كامل):\n";
        filteredSubjectAccess.forEach(access => {
            // (access.subjects موجود 100% بسبب الفلترة)
            message += `- ${access.subjects.title}\n`;
            keyboard.push([{ text: `❌ سحب [مادة ${access.subjects.title}]`, callback_data: `revoke_subject_${targetUserId}_${access.subjects.id}`}]);
        });
    }
    // --- [ ✅ التعديل ينتهي هنا ] ---

    // 7. رسائل توضيحية
    if ((!courseAccess || courseAccess.length === 0) && (!subjectAccess || subjectAccess.length === 0)) {
        message += 'لا يمتلك هذا المستخدم أي صلاحيات حالياً.';
    } else if (courseAccess.length > 0 && filteredSubjectAccess.length === 0 && subjectAccess && subjectAccess.length > 0) {
        // (رسالة توضيحية إذا كانت كل المواد المحددة مخفية بسبب التكرار)
        message += "\n\n(يمتلك صلاحيات مواد محددة ولكنها مُضمّنة في الكورسات الكاملة أعلاه)";
    }

    keyboard.push([{ text: '⛔️ سحب "جميع" الصلاحيات', callback_data: `revoke_all_${targetUserId}`}]);
    // [ ✅ تعديل: إضافة زر الرئيسية ]
  keyboard.push([
      { text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' },
      { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
  ]);
    
    await editMessage(adminChatId, messageId, message, { inline_keyboard: keyboard });
    
  } catch (error) {
    console.error("Error in sendRevokeMenu:", error);
    await editMessage(adminChatId, messageId, `حدث خطأ: ${error.message}`);
  }
};


// (الخطوة 1: اختيار الكورس)
const sendGrantUser_Step1_SelectCourse = async (chatId, messageId, stateData) => {
    const { data: courses, error } = await supabase.from('courses').select('id, title, sort_order').order('sort_order');
    if (error || !courses || courses.length === 0) {
        return await editMessage(chatId, messageId, 'لا توجد كورسات لعرضها.');
    }

    const keyboard = buildKeyboard(courses.map(c => ({ id: c.id, text: `📚 ${c.title}` })), 'admin_grant_course_');
    keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' }]);
    
    const text = `منح صلاحيات لـ ${stateData.users.length} مستخدم.\n\nالخطوة 1: اختر الكورس:`;
    await setUserState(chatId, 'awaiting_grant_selection', { ...stateData, step: 1, courses: courses });
    await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
};

// (الخطوة 2: اختيار نوع الصلاحية)
const sendGrantUser_Step2_SelectType = async (chatId, messageId, stateData, courseId) => {
    const course = stateData.courses.find(c => c.id === courseId);
    if (!course) return await editMessage(chatId, messageId, 'خطأ: الكورس غير موجود.');

    const keyboard = { inline_keyboard: [
        [{ text: `📦 منح "الكورس الكامل" (${course.title})`, callback_data: `admin_grant_type_full_${courseId}` }],
        [{ text: '📖 منح "مواد معينة" من هذا الكورس', callback_data: `admin_grant_type_specific_${courseId}` }],
        [{ text: '🔙 رجوع (لاختيار الكورس)', callback_data: 'admin_add_users_start' }],
        [{ text: '❌ إلغاء', callback_data: 'admin_manage_users' }]
    ]};
    
    const text = `منح صلاحيات لـ ${stateData.users.length} مستخدم.\nالكورس: "${course.title}"\n\nالخطوة 2: اختر نوع الصلاحية:`;
    await setUserState(chatId, 'awaiting_grant_selection', { ...stateData, step: 2, selected_course: course });
    await editMessage(chatId, messageId, text, keyboard);
};

// (الخطوة 3: اختيار مواد محددة)
const sendGrantUser_Step3_SelectSubjects = async (chatId, messageId, stateData) => {
    const courseId = stateData.selected_course.id;
    const { data: subjects, error } = await supabase.from('subjects').select('id, title, sort_order').eq('course_id', courseId).order('sort_order');
    
    if (error || !subjects || subjects.length === 0) {
        await editMessage(chatId, messageId, 'عذراً، لا توجد مواد متاحة حالياً في هذا الكورس.');
        await setUserState(chatId, 'awaiting_grant_selection', { ...stateData, step: 2 });
        return;
    }
    
    const selected_subjects = stateData.selected_subjects || [];
    const selected_subject_ids = selected_subjects.map(s => s.id);
    
    const keyboard = [];
    subjects.forEach(s => {
        const isSelected = selected_subject_ids.includes(s.id);
        keyboard.push([{ 
            text: `${isSelected ? '✅' : ''} ${s.title}`, 
            callback_data: `admin_grant_toggle_${s.id}|${s.title}`
        }]);
    });
    
    keyboard.push([{ text: `✅ منح "كل" المواد (لهذا الكورس فقط)`, callback_data: 'admin_grant_all_subjects_in_course' }]);

    if (selected_subjects.length > 0) {
         keyboard.push([{ text: '👍 تأكيد ومنح الصلاحيات المحددة', callback_data: 'admin_grant_finish_specific' }]);
    }
    
    keyboard.push([{ text: '🔙 رجوع (لاختيار النوع)', callback_data: `admin_grant_course_${courseId}` }]);
    keyboard.push([{ text: '❌ إلغاء', callback_data: 'admin_manage_users' }]);
    
    const text = `منح صلاحيات لـ ${stateData.users.length} مستخدم.\nالخطوة 3: اختر المواد المحددة:`;
    await setUserState(chatId, 'awaiting_grant_selection', { ...stateData, step: 3, subjects: subjects, selected_subjects: selected_subjects });
    await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
};


// --- [ (6) دوال المستخدم: طلب الاشتراك (الجديدة) ] ---

// (الخطوة 1: عرض الكورسات)

// (الخطوة 1: عرض الكورسات مع السعر)
const sendSubscription_Step1_SelectCourse = async (chatId, messageId = null) => {
    // [ ✅ تعديل: جلب السعر ]
    const { data: courses, error } = await supabase.from('courses').select('id, title, sort_order, price').order('sort_order');
    if (error || !courses || courses.length === 0) {
        const msg = 'عذراً، لا توجد كورسات متاحة للاشتراك بها حالياً.';
        if (messageId) await editMessage(chatId, messageId, msg);
        else await sendMessage(chatId, msg, null, null, true);
        return;
    }

    const keyboard = buildKeyboard(
        // [ ✅ تعديل: عرض السعر في الزر ]
        courses.map(c => ({ 
            id: c.id, 
            text: `📚 ${c.title} (${c.price || 0} ج)` 
        })), 
        'sub_req_course_'
    );
    keyboard.push([{ text: '🔙 إلغاء', callback_data: 'sub_req_cancel' }]);
    
    const text = 'الخطوة 1: اختر الكورس الذي ترغب بالاشتراك به:';
    await setUserState(chatId, 'awaiting_subscription_choice', { step: 1, courses: courses }); // (الكورسات الآن تحتوي على السعر)

    if (messageId) {
        await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
    } else {
        await sendMessage(chatId, text, { inline_keyboard: keyboard }, null, true);
    }
};

// (الخطوة 2: اختيار نوع الاشتراك "كامل" أم "محدد")
const sendSubscription_Step2_SelectType = async (chatId, messageId, stateData, courseId) => {
    const course = stateData.courses.find(c => c.id === courseId);
    if (!course) {
        await editMessage(chatId, messageId, 'خطأ: الكورس غير موجود. الرجاء البدء من جديد.');
        await setUserState(chatId, null, null);
        return;
    }
    
    const keyboard = { inline_keyboard: [
        // [ ✅ تعديل: عرض سعر الكورس الكامل ]
        [{ text: `📦 اشتراك كامل (${course.price || 0} ج)`, callback_data: `sub_req_type_full_${courseId}` }],
        [{ text: '📖 اختيار مواد معينة', callback_data: `sub_req_type_specific_${courseId}` }],
        [{ text: '🔙 رجوع (لاختيار الكورس)', callback_data: 'user_request_subscription' }],
        [{ text: '❌ إلغاء', callback_data: 'sub_req_cancel' }]
    ]};
    
    const text = `الخطوة 2: اختر نوع الاشتراك في "${course.title}":`;
    // (stateData.selected_course الآن يحتوي على السعر)
    await setUserState(chatId, 'awaiting_subscription_choice', { ...stateData, step: 2, selected_course: course });
    await editMessage(chatId, messageId, text, keyboard);
};

// (الخطوة 3: اختيار مواد محددة مع السعر)
const sendSubscription_Step3_SelectSubjects = async (chatId, messageId, stateData) => {
    const courseId = stateData.selected_course.id;
    // [ ✅ تعديل: جلب السعر ]
    const { data: subjects, error } = await supabase.from('subjects').select('id, title, sort_order, price').eq('course_id', courseId).order('sort_order');
    
    if (error || !subjects || subjects.length === 0) {
        await editMessage(chatId, messageId, 'عذراً، لا توجد مواد متاحة حالياً في هذا الكورس.');
        await setUserState(chatId, 'awaiting_subscription_choice', { ...stateData, step: 2 });
        return;
    }
    
    const selected_subjects = stateData.selected_subjects || [];
    const selected_subject_ids = selected_subjects.map(s => s.id);
    
    let total = 0; // (حساب الإجمالي)
    
    const keyboard = [];
    subjects.forEach(s => {
        const isSelected = selected_subject_ids.includes(s.id);
        if (isSelected) total += (s.price || 0); // (إضافة للسعر الإجمالي)
        
        keyboard.push([{ 
            // [ ✅ تعديل: عرض السعر وتمريره في الـ callback ]
            text: `${isSelected ? '✅' : ''} ${s.title} (${s.price || 0} ج)`, 
            callback_data: `sub_req_toggle_${s.id}|${s.title}|${s.price || 0}` 
        }]);
    });

    if (selected_subjects.length > 0) {
         keyboard.push([{ text: `👍 تأكيد الإختيار (الإجمالي: ${total} ج)`, callback_data: 'sub_req_submit_subjects' }]);
    }
    
    keyboard.push([{ text: '🔙 رجوع (لاختيار النوع)', callback_data: `sub_req_course_${courseId}` }]);
    keyboard.push([{ text: '❌ إلغاء', callback_data: 'sub_req_cancel' }]);
    
    // [ ✅ تعديل: عرض الإجمالي في الرسالة ]
    const text = `الخطوة 3: اختر المواد التي ترغب بها.\nالإجمالي الحالي: ${total} ج`;
    await setUserState(chatId, 'awaiting_subscription_choice', { ...stateData, step: 3, subjects: subjects, selected_subjects: selected_subjects, current_total: total });
    await editMessage(chatId, messageId, text, { inline_keyboard: keyboard });
};
// --- [ (7) دوال نظام طلبات الاشتراك (المساعدة) ] ---

const notifyAdminsOfNewRequest = async (request) => {
    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
    if (!admins || admins.length === 0) return;
    
    // [ ✅ تعديل: إظهار السعر ]
    let caption = `<b>🔔 طلب اشتراك جديد</b>\n\n` +
                  `<b>المستخدم:</b> ${request.user_name || 'غير متوفر'}\n` +
                  (request.user_username ? `<b>المعرف:</b> @${request.user_username}\n` : '') +
                  `<b>ID:</b> <code>${request.user_id}</code>\n\n` +
                  `💰 <b>الإجمالي:</b> ${request.total_price || 0} ج\n` +
                  `<b>الطلب:</b>\n${request.course_title}`;
                  
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ موافقة', callback_data: `approve_sub_${request.id}` },
        { text: '❌ رفض', callback_data: `reject_sub_${request.id}` }
      ]]
    };

    for (const admin of admins) {
      await sendPhotoMessage(admin.id, request.payment_file_id, caption, keyboard);
    }
};

const sendPendingRequests = async (chatId, messageId) => {
    const { data: requests, error } = await supabase.from('subscription_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    
    if (messageId) {
        await editMessage(chatId, messageId, 'جاري جلب الطلبات المعلقة...');
    }
    
    if (error || !requests || requests.length === 0) {
        await sendMessage(chatId, 'لا توجد طلبات اشتراك معلقة حالياً.');
        return;
    }
    
    await sendMessage(chatId, `يوجد ${requests.length} طلب اشتراك معلق:`);
    for (const request of requests) {
        // [ ✅ تعديل: إظهار السعر ]
        let caption = `<b>🔔 طلب اشتراك معلق</b>\n\n` +
                      `<b>المستخدم:</b> ${request.user_name || 'غير متوفر'}\n` +
                      (request.user_username ? `<b>المعرف:</b> @${request.user_username}\n` : '') +
                      `<b>ID:</b> <code>${request.user_id}</code>\n\n` +
                      `💰 <b>الإجمالي:</b> ${request.total_price || 0} ج\n` +
                      `<b>الطلب:</b>\n${request.course_title}`;
        
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ موافقة', callback_data: `approve_sub_${request.id}` },
            { text: '❌ رفض', callback_data: `reject_sub_${request.id}` }
          ]]
        };
        await sendPhotoMessage(chatId, request.payment_file_id, caption, keyboard);
    }
};


// ===============================================
// --- 🚀 الـ Webhook الرئيسي 🚀 ---
// ===============================================
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  let user, chatId, userId, text;
  let from, messageId; 

  try {
    const { message, callback_query } = req.body;

    // --- ( 1. معالجة الأزرار - Callback Query) ---
    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id);
      from = callback_query.from; 
      messageId = callback_query.message.message_id;
      user = await getUser(userId);
      const command = callback_query.data;
      
      await answerCallbackQuery(callback_query.id);

      if (!user) return res.status(200).send('OK');
      if(command === 'noop') return res.status(200).send('OK');

      // --- [ (مسار المستخدم العادي - ضغط الأزرار) ] ---
      if (!user.is_admin) {
        
        if (command === 'user_request_subscription') {
            await sendSubscription_Step1_SelectCourse(chatId, messageId);
            return res.status(200).send('OK');
        }

        if (command === 'sub_req_cancel') {
            await setUserState(userId, null, null);
            await editMessage(chatId, messageId, 'تم إلغاء الطلب.', null);
            return res.status(200).send('OK');
        }
        
        const currentState = user.admin_state;
        const stateData = user.state_data;

        if (currentState === 'awaiting_subscription_choice') {
            
            if (command.startsWith('sub_req_course_')) {
                const courseId = parseInt(command.split('_')[3], 10);
                await sendSubscription_Step2_SelectType(chatId, messageId, stateData, courseId);
                return res.status(200).send('OK');
            }
            
            if (command.startsWith('sub_req_type_full_')) {
                const course = stateData.selected_course;
                const coursePrice = course.price || 0;
                const requestTitle = `${course.title} (اشتراك كامل)`;
                
                await setUserState(userId, 'awaiting_payment_proof', {
                    request_type: 'course',
                    items: [{ id: course.id, title: course.title, price: coursePrice }],
                    description: requestTitle,
                    total_price: coursePrice // [ ✅ تعديل: حفظ السعر ]
                });
                
                await editMessage(chatId, messageId, `لقد اخترت:\n- ${requestTitle}\n\n💰 الإجمالي المطلوب: ${coursePrice} ج\n\nالرجاء الآن إرسال صورة واحدة (Screenshot) تثبت عملية الدفع.`);
                return res.status(200).send('OK');
            }
          
            if (command.startsWith('sub_req_type_specific_')) {
                await sendSubscription_Step3_SelectSubjects(chatId, messageId, stateData);
                return res.status(200).send('OK');
            }

            if (command.startsWith('sub_req_toggle_')) {
                const parts = command.substring('sub_req_toggle_'.length).split('|');
                const subjectId = parseInt(parts[0], 10);
                const subjectTitle = parts[1];
                const subjectPrice = parseInt(parts[2], 10) || 0; // [ ✅ تعديل: قراءة السعر ]
                
                if (!subjectTitle) return res.status(200).send('OK');
                
                let selected = stateData.selected_subjects || [];
                const index = selected.findIndex(c => c.id === subjectId);
                
                if (index > -1) {
                    selected.splice(index, 1); // إلغاء الاختيار
                } else {
                    selected.push({ id: subjectId, title: subjectTitle, price: subjectPrice }); // [ ✅ تعديل: حفظ السعر ]
                }
                
                const newState = { ...stateData, selected_subjects: selected };
                await sendSubscription_Step3_SelectSubjects(chatId, messageId, newState);
                return res.status(200).send('OK');
            }
            
            // (الخطوة 3: المستخدم يضغط "تأكيد" للمواد)
            if (command === 'sub_req_submit_subjects') {
                if (!stateData.selected_subjects || stateData.selected_subjects.length === 0) {
                    await answerCallbackQuery(callback_query.id, { text: 'الرجاء اختيار مادة واحدة على الأقل.' });
                    return res.status(200).send('OK');
                }
                
                const titles = stateData.selected_subjects.map(c => ` ${c.title} (${c.price} ج)`).join('\n- ');
                const requestTitle = stateData.selected_subjects.map(c => c.title).join(', ');
                const totalPrice = stateData.current_total || 0; // [ ✅ تعديل: جلب الإجمالي ]
                
                await setUserState(userId, 'awaiting_payment_proof', {
                    request_type: 'subject',
                    items: stateData.selected_subjects,
                    description: requestTitle,
                    total_price: totalPrice // [ ✅ تعديل: حفظ السعر الإجمالي ]
                });
                
                await editMessage(
                    chatId, messageId,
                    `لقد اخترت:\n- ${titles}\n\n💰 الإجمالي المطلوب: ${totalPrice} ج\n\nالرجاء الآن إرسال صورة واحدة (Screenshot) تثبت عملية الدفع.`,
                    null 
                );
                return res.status(200).send('OK');
            }
        } // (نهاية حالة 'awaiting_subscription_choice')

        await sendMessage(chatId, 'أنت لست أدمن.', null, null, true);
        return res.status(200).send('OK');
      } // (نهاية if !user.is_admin)

      // --- [ (مسار الأدمن - ضغط الأزرار) ] ---
      
      // 1. التنقل الرئيسي للأدمن
      if (command === 'admin_main_menu') {
        await sendAdminMenu(chatId, user, messageId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_users') {
        await sendUserMenu(chatId, messageId);
        return res.status(200).send('OK');
      }
      
      // 2. قسم الإشراف
      if (command === 'admin_supervision') {
        await sendSupervisionMenu(chatId, user, messageId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_stats') {
        await sendStatistics(chatId, messageId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_manage_admins') {
        if (String(user.id) !== MAIN_ADMIN_ID) {
            await answerCallbackQuery(callback_query.id, { text: 'هذا القسم للأدمن الرئيسي فقط.' });
            return res.status(200).send('OK');
        }
        await sendAdminManagementMenu(chatId, messageId);
        return res.status(200).send('OK');
      }
      if (command === 'admin_add_admin' || command === 'admin_remove_admin') {
         if (String(user.id) !== MAIN_ADMIN_ID) return res.status(200).send('OK');
         const state = (command === 'admin_add_admin') ? 'awaiting_admin_id_to_add' : 'awaiting_admin_id_to_remove';
         const text = (command === 'admin_add_admin') ? 'أرسل الـ ID لترقيته:' : 'أرسل الـ ID لإزالته:';
         await setUserState(userId, state, { message_id: messageId });
         await editMessage(chatId, messageId, text + ' (أو /cancel)');
         return res.status(200).send('OK');
      }

      // 3. إدارة المحتوى (التنقل)
      if (command === 'admin_manage_content') {
        await sendContentMenu_Courses(chatId, messageId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_nav_course_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await sendContentMenu_Subjects(chatId, messageId, courseId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_nav_subject_')) {
        const subjectId = parseInt(command.split('_')[3], 10);
        await sendContentMenu_Chapters(chatId, messageId, subjectId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_nav_chapter_')) {
        const chapterId = parseInt(command.split('_')[3], 10);
        await sendContentMenu_Videos(chatId, messageId, chapterId);
        return res.status(200).send('OK');
      }

      
// 4. إدارة المحتوى (الإضافة - [ ✅ تعديل: للسؤال عن السعر ])
      if (command === 'content_add_course') {
        await setUserState(userId, 'awaiting_course_title', { message_id: messageId });
        await editMessage(chatId, messageId, '📚 أرسل "اسم" الكورس الجديد: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_add_subject_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await setUserState(userId, 'awaiting_subject_title', { message_id: messageId, course_id: courseId });
        await editMessage(chatId, messageId, '📖 أرسل "اسم" المادة الجديدة: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      // (باقي أوامر الإضافة "شابتر" و "فيديو" تبقى كما هي لأنها لا تحتاج سعر)
      if (command.startsWith('content_add_chapter_')) {
        const subjectId = parseInt(command.split('_')[3], 10);
        await setUserState(userId, 'awaiting_chapter_title', { message_id: messageId, subject_id: subjectId });
        await editMessage(chatId, messageId, '📁 أرسل "اسم" الشابتر الجديد: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
      }
      if (command.startsWith('content_add_video_')) {
        const chapterId = parseInt(command.split('_')[3], 10);
        await setUserState(userId, 'awaiting_video_title', { message_id: messageId, chapter_id: chapterId });
        await editMessage(chatId, messageId, '🚀 أرسل "عنوان" الفيديو: (أو /cancel للإلغاء)');
        return res.status(200).send('OK');
               
    }

      // [ ✅ جديد: أوامر تعديل السعر ]
      if (command.startsWith('content_edit_course_price_')) {
          const courseId = parseInt(command.split('_')[4], 10);
          await setUserState(userId, 'awaiting_course_new_price', { message_id: messageId, course_id: courseId });
          await editMessage(chatId, messageId, '💰 أرسل "السعر الجديد" للكورس: (أو /cancel)');
          return res.status(200).send('OK');
      }
      if (command.startsWith('content_edit_subject_price_')) {
          const subjectId = parseInt(command.split('_')[4], 10);
          await setUserState(userId, 'awaiting_subject_new_price', { message_id: messageId, subject_id: subjectId });
          await editMessage(chatId, messageId, '💰 أرسل "السعر الجديد" للمادة: (أو /cancel)');
          return res.status(200).send('OK');
      }
      // 5. إدارة المحتوى (الحذف)
      // 5. إدارة المحتوى (الحذف)
      
      // (حذف الكورس - هذا صحيح لا يحتاج تعديل)
      if (command.startsWith('delete_course_confirm_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await supabase.from('courses').delete().eq('id', courseId);
        await answerCallbackQuery(callback_query.id, { text: '🗑️ تم حذف الكورس وكل محتوياته' });
        await sendContentMenu_Courses(chatId, messageId);
        return res.status(200).send('OK');
      }
      
      // (حذف المادة - picker)
      if (command.startsWith('content_del_subject_picker_')) {
        const courseId = parseInt(command.split('_')[4], 10);
        const { data: items } = await supabase.from('subjects').select('id, title').eq('course_id', courseId);
        // [ ✅✅ إصلاح 1: تمرير courseId إلى prefix الحذف ]
        await sendDeletionPicker(chatId, messageId, items, `content_nav_course_${courseId}`, `delete_subject_confirm_${courseId}_`);
        return res.status(200).send('OK');
      }
      // (حذف المادة - handler)
      if (command.startsWith('delete_subject_confirm_')) {
        // [ ✅✅ إصلاح 1: قراءة IDs بالترتيب الصحيح ]
        const courseId = parseInt(command.split('_')[3], 10);
        const subjectId = parseInt(command.split('_')[4], 10);
        await supabase.from('subjects').delete().eq('id', subjectId);
        await answerCallbackQuery(callback_query.id, { text: '🗑️ تم حذف المادة وكل شباترها' });
        await sendContentMenu_Subjects(chatId, messageId, courseId);
        return res.status(200).send('OK');
      }

      // (حذف الشابتر - picker)
      if (command.startsWith('content_del_chapter_picker_')) {
        const subjectId = parseInt(command.split('_')[4], 10);
        const { data: items } = await supabase.from('chapters').select('id, title').eq('subject_id', subjectId);
        // [ ✅✅ إصلاح 1: تمرير subjectId إلى prefix الحذف ]
        await sendDeletionPicker(chatId, messageId, items, `content_nav_subject_${subjectId}`, `delete_chapter_confirm_${subjectId}_`);
        return res.status(200).send('OK');
      }
      // (حذف الشابتر - handler)
      if (command.startsWith('delete_chapter_confirm_')) {
        // [ ✅✅ إصلاح 1: قراءة IDs بالترتيب الصحيح ]
        const subjectId = parseInt(command.split('_')[3], 10);
        const chapterId = parseInt(command.split('_')[4], 10);
        await supabase.from('chapters').delete().eq('id', chapterId);
        await answerCallbackQuery(callback_query.id, { text: '🗑️ تم حذف الشابتر وكل فيديوهاته' });
        await sendContentMenu_Chapters(chatId, messageId, subjectId);
        return res.status(200).send('OK');
      }

      // (حذف الفيديو - هذا صحيح لا يحتاج تعديل)
      if (command.startsWith('content_del_video_confirm_')) {
        const chapterId = parseInt(command.split('_')[4], 10);
        const videoId = parseInt(command.split('_')[5], 10);
        await supabase.from('videos').delete().eq('id', videoId);
        await answerCallbackQuery(callback_query.id, { text: '🗑️ تم حذف الفيديو' });
        await sendContentMenu_Videos(chatId, messageId, chapterId); // (تحديث القائمة)
        return res.status(200).send('OK');
      }

      // 6. إدارة المحتوى (الترتيب)
      if (command.startsWith('content_order_start_')) {
        const type = command.split('_')[3]; // 'courses', 'subjects', 'chapters', 'videos'
        let items = [];
        let nav_callback = '';
        let query = supabase.from(type).select('id, title, sort_order');
        let parentId = null;
        
        if (command.split('_').length > 4) {
             parentId = parseInt(command.split('_')[4], 10);
        }

        if (type === 'subjects') {
            query = query.eq('course_id', parentId);
            nav_callback = `content_nav_course_${parentId}`;
        } else if (type === 'chapters') {
            query = query.eq('subject_id', parentId);
            nav_callback = `content_nav_subject_${parentId}`;
        } else if (type === 'videos') {
            query = query.eq('chapter_id', parentId);
            nav_callback = `content_nav_chapter_${parentId}`;
        } else {
             nav_callback = 'admin_manage_content';
        }
        
        const { data } = await query.order('sort_order');
        items = data || [];
        
        await sendOrderingMenu(chatId, messageId, type, items, nav_callback);
        return res.status(200).send('OK');
      }
      
      // 7. إدارة المحتوى (نسخ الصلاحيات)
      if (command.startsWith('copy_perms_skip_')) {
         const subjectId = parseInt(command.split('_')[3], 10);
         const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', subjectId).single();
         await answerCallbackQuery(callback_query.id, { text: 'تم الحفظ.' });
         await sendContentMenu_Subjects(chatId, messageId, subject.course_id);
         return res.status(200).send('OK');
      }
      if (command.startsWith('copy_perms_start_')) {
         const newSubjectId = parseInt(command.split('_')[3], 10);
         const { data: allSubjects } = await supabase.from('subjects').select('id, title').neq('id', newSubjectId).order('title');
         
         if (!allSubjects || allSubjects.length === 0) {
              await answerCallbackQuery(callback_query.id, { text: 'لا توجد مواد أخرى للنسخ منها.' });
              return res.status(200).send('OK');
         }
         
         const keyboard = buildKeyboard(allSubjects.map(s => ({ id: s.id, text: `📖 ${s.title}` })), `copy_perms_execute_${newSubjectId}_`);
         keyboard.push([{ text: '🔙 إلغاء', callback_data: `copy_perms_skip_${newSubjectId}` }]);
         await editMessage(chatId, messageId, 'اختر "المادة المصدر" التي تريد نسخ المستخدمين منها:', { inline_keyboard: keyboard });
         return res.status(200).send('OK');
      }
      if (command.startsWith('copy_perms_execute_')) {
         const newSubjectId = parseInt(command.split('_')[3], 10);
         const sourceSubjectId = parseInt(command.split('_')[4], 10);
         
         await editMessage(chatId, messageId, 'جاري نسخ الصلاحيات، يرجى الانتظار...');
         
         const { data: usersToCopy, error } = await supabase
            .from('user_subject_access')
            .select('user_id')
            .eq('subject_id', sourceSubjectId);
            
        let count = 0;
        if (usersToCopy && usersToCopy.length > 0) {
            const insertPayload = usersToCopy.map(u => ({ user_id: u.user_id, subject_id: newSubjectId }));
            const { error: insertErr } = await supabase.from('user_subject_access').upsert(
                insertPayload, 
                { onConflict: 'user_id, subject_id', ignoreDuplicates: true }
            );
            if(insertErr) throw insertErr;
            count = usersToCopy.length;
        }
        
        await answerCallbackQuery(callback_query.id, { text: `✅ تم نسخ صلاحيات ${count} مستخدم` });
        const { data: subject } = await supabase.from('subjects').select('course_id').eq('id', newSubjectId).single();
        await sendContentMenu_Subjects(chatId, messageId, subject.course_id);
        return res.status(200).send('OK');
      }

      // 8. إدارة المستخدمين (الأوامر النصية)
      if (command === 'admin_add_users') {
        await setUserState(userId, 'awaiting_user_ids', { message_id: messageId });
        await editMessage(chatId, messageId, '👤 أرسل الآن ID واحد أو أكثر (افصل بينهم بمسافة أو سطر جديد): (أو /cancel)');
        return res.status(200).send('OK');
      }
      if (command === 'admin_reset_device') {
        await setUserState(userId, 'awaiting_device_reset_id', { message_id: messageId });
        await editMessage(chatId, messageId, '👤 أرسل ID المستخدم (أو عدة IDs) الذي تريد حذف بصمته: (أو /cancel)');
        return res.status(200).send('OK');
      }
      if (command === 'admin_revoke_permissions') {
        await setUserState(userId, 'awaiting_user_id_for_revoke', { message_id: messageId });
        await editMessage(chatId, messageId, '👤 أرسل ID المستخدم الواحد الذي تريد مراجعة صلاحياته: (أو /cancel)');
        return res.status(200).send('OK');
      }

      // 9. إدارة المستخدمين (منح الصلاحيات - تدفق الأزرار)
      if (command === 'admin_add_users_start') {
         const stateData = user.state_data;
         await sendGrantUser_Step1_SelectCourse(chatId, messageId, stateData);
         return res.status(200).send('OK');
      }
      
      if (user.admin_state === 'awaiting_grant_selection') {
        const stateData = user.state_data;
        const usersToUpdate = stateData.users;
        
        if (command.startsWith('admin_grant_course_')) {
            const courseId = parseInt(command.split('_')[3], 10);
            await sendGrantUser_Step2_SelectType(chatId, messageId, stateData, courseId);
            return res.status(200).send('OK');
        }
        
        // (الخطوة 2: اختار "كورس كامل")
        if (command.startsWith('admin_grant_type_full_')) {
            const courseId = parseInt(command.split('_')[4], 10);
            const accessObjects = usersToUpdate.map(uid => ({ user_id: uid, course_id: courseId }));
            
            await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
            
            // [ ✅ إصلاح 1: استخدام answerCallbackQuery ]
            await answerCallbackQuery(callback_query.id, { text: `✅ تم منح صلاحية "الكورس الكامل" لـ ${usersToUpdate.length} مستخدم.` });
            await setUserState(userId, null, null);
            await sendUserMenu(chatId, messageId); // (العودة لقائمة المستخدمين)
            return res.status(200).send('OK');
        }
        
        
        
        if (command.startsWith('admin_grant_type_specific_')) {
            await sendGrantUser_Step3_SelectSubjects(chatId, messageId, stateData);
            return res.status(200).send('OK');
        }

        if (command.startsWith('admin_grant_toggle_')) {
            const parts = command.substring('admin_grant_toggle_'.length).split('|');
            const subjectId = parseInt(parts[0], 10);
            const subjectTitle = parts[1];
            
            let selected = stateData.selected_subjects || [];
            const index = selected.findIndex(s => s.id === subjectId);
            
            if (index > -1) selected.splice(index, 1);
            else selected.push({ id: subjectId, title: subjectTitle });
            
            const newState = { ...stateData, selected_subjects: selected };
            await sendGrantUser_Step3_SelectSubjects(chatId, messageId, newState);
            return res.status(200).send('OK');
        }
        
        if (command === 'admin_grant_all_subjects_in_course') {
            const allSubjects = stateData.subjects.map(s => ({ id: s.id, title: s.title }));
            const newState = { ...stateData, selected_subjects: allSubjects };
            await sendGrantUser_Step3_SelectSubjects(chatId, messageId, newState);
            await answerCallbackQuery(callback_query.id, { text: 'تم تحديد الكل' });
            return res.status(200).send('OK');
        }

        if (command === 'admin_grant_finish_specific') {
            const selectedIds = (stateData.selected_subjects || []).map(s => s.id);
            if (selectedIds.length === 0) {
                 await answerCallbackQuery(callback_query.id, { text: 'لم تختر أي مواد.' });
                 return res.status(200).send('OK');
            }
            
            const accessObjects = [];
            usersToUpdate.forEach(uid => {
                selectedIds.forEach(sid => {
                    accessObjects.push({ user_id: uid, subject_id: sid });
                });
            });
            
            await supabase.from('user_subject_access').upsert(accessObjects, { onConflict: 'user_id, subject_id' });
            
            // [ ✅ إصلاح 1: استخدام answerCallbackQuery ]
            await answerCallbackQuery(callback_query.id, { text: `✅ تم منح ${selectedIds.length} مادة محددة لـ ${usersToUpdate.length} مستخدم.` });
            await setUserState(userId, null, null);
            await sendUserMenu(chatId, messageId); // (العودة لقائمة المستخدمين)
            return res.status(200).send('OK');
        }
      } // (نهاية حالة 'awaiting_grant_selection')

      // 10. إدارة المستخدمين (سحب الصلاحيات)
      if (command.startsWith('revoke_all_')) {
        const targetUserId = command.split('_')[2];
        await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
        await supabase.from('user_subject_access').delete().eq('user_id', targetUserId);
        await answerCallbackQuery(callback_query.id, { text: '✅ تم سحب "جميع" الصلاحيات' });
        await sendRevokeMenu(chatId, targetUserId, messageId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_full_course_')) {
        const targetUserId = command.split('_')[3];
        const courseId = command.split('_')[4];
        await supabase.from('user_course_access').delete().match({ user_id: targetUserId, course_id: courseId });
        await answerCallbackQuery(callback_query.id, { text: '✅ تم سحب صلاحية الكورس الكامل' });
        await sendRevokeMenu(chatId, targetUserId, messageId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_subject_')) {
        const targetUserId = command.split('_')[2];
        const subjectId = command.split('_')[3];
        await supabase.from('user_subject_access').delete().match({ user_id: targetUserId, subject_id: subjectId });
        await answerCallbackQuery(callback_query.id, { text: '✅ تم سحب صلاحية المادة المحددة' });
        await sendRevokeMenu(chatId, targetUserId, messageId);
        return res.status(200).send('OK');
      }

      // 11. نظام طلبات الاشتراك
      if (command === 'admin_view_requests') {
          await sendPendingRequests(chatId, messageId);
          return res.status(200).send('OK');
      }

      if (command.startsWith('reject_sub_')) {
          const requestId = parseInt(command.split('_')[2], 10);
          const { data: request } = await supabase.from('subscription_requests').select('user_id').eq('id', requestId).single();
          if (!request) return await answerCallbackQuery(callback_query.id, { text: 'الطلب غير موجود' });
          
          if (callback_query.message.reply_markup && (!callback_query.message.reply_markup.inline_keyboard || callback_query.message.reply_markup.inline_keyboard.length === 0)) {
               return await answerCallbackQuery(callback_query.id, { text: 'تم التعامل مع هذا الطلب مسبقاً.' });
          }

          await setUserState(userId, 'awaiting_rejection_reason', { 
              request_id: requestId, 
              target_user_id: request.user_id,
              admin_message_id: messageId,
              original_caption: callback_query.message.caption
          });
          
          await sendMessage(chatId, 'أرسل الآن "سبب الرفض" (سيتم إرسال ملاحظتك للمستخدم، أو اضغط /cancel للإلغاء):');
          return res.status(200).send('OK');
      }
      
      // [ ✅✅ تعديل: تغيير منطق الموافقة ]
      if (command.startsWith('approve_sub_')) {
          const requestId = parseInt(command.split('_')[2], 10);
          
          const { data: request, error: reqError } = await supabase
              .from('subscription_requests')
              .select('*, requested_data')
              .eq('id', requestId)
              .single();

          if (reqError || !request) {
              return await answerCallbackQuery(callback_query.id, { text: 'خطأ: لم يتم العثور على هذا الطلب.' });
          }
          if (request.status === 'approved') {
              return await answerCallbackQuery(callback_query.id, { text: 'تمت الموافقة على هذا الطلب مسبقاً.' });
          }

          const targetUserId = request.user_id;
          const requestedData = request.requested_data || [];
          
          let userMessage = `🎉 تهانينا، تمت الموافقة على اشتراكك في:\n\n- ${request.course_title.replace(/, /g, '\n- ')}\n\n`;

          for (const item of requestedData) {
              if (item.type === 'course') {
                  await supabase.from('user_course_access').upsert(
                      { user_id: targetUserId, course_id: item.id },
                      { onConflict: 'user_id, course_id' }
                  );
              } else if (item.type === 'subject') {
                  await supabase.from('user_subject_access').upsert(
                      { user_id: targetUserId, subject_id: item.id },
                      { onConflict: 'user_id, subject_id' }
                  );
              }
          }
          
          await supabase.from('subscription_requests').update({ status: 'approved' }).eq('id', requestId);
          
          userMessage += `هام جداً:\n` +
                         `هذا هو ID الخاص بك، استخدمه لتسجيل الدخول في التطبيق:\n` +
                         `<code>${targetUserId}</code>`;
                         
          await sendMessage(targetUserId, userMessage, null, 'HTML', true); // إبلاغ المستخدم

          // [ ✅✅ تعديل: إخفاء الأزرار من رسالة الصورة ]
          try {
              await axios.post(`${TELEGRAM_API}/editMessageReplyMarkup`, {
                    chat_id: chatId,
                    message_id: messageId, // (ID رسالة الصورة)
                    reply_markup: null // (إزالة الأزرار)
              });
          } catch(e) {
              console.warn("Could not edit photo reply markup (maybe deleted):", e.message);
          }
          
          // [ ✅✅ تعديل: إرسال رسالة تأكيد "جديدة" مع أزرار ]
          const confirmationKeyboard = { inline_keyboard: [
              [
                  { text: '🔙 رجوع (للطلبات)', callback_data: 'admin_view_requests' },
                  { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
              ]
          ]};
          await sendMessage(chatId, `✅ تمت الموافقة بنجاح للمستخدم ${targetUserId}.`, confirmationKeyboard);
          
          return res.status(200).send('OK');
      }
      

    // --- ( 2. معالجة الرسائل النصية والصور) ---
    if (message && message.from) {
      chatId = message.chat.id;
      userId = String(message.from.id);
      text = message.text;
      from = message.from; 
      user = await getUser(userId);

      if (!user) return res.status(200).send('OK');

      // أمر /start
      if (text === '/start') {
        await setUserState(userId, null, null);
        if (user.is_admin) {
          await sendAdminMenu(chatId, user);
        } else {
          // (التحقق من الصلاحيات الجديدة)
          const { data: courseAccess } = await supabase.from('user_course_access').select('courses(title)').eq('user_id', userId);
          const { data: subjectAccess } = await supabase.from('user_subject_access').select('subjects(title)').eq('user_id', userId);

          const hasCourseAccess = courseAccess && courseAccess.length > 0;
          const hasSubjectAccess = subjectAccess && subjectAccess.length > 0;
          
          const requestButtonKeyboard = { 
              inline_keyboard: [[ { text: '📋 طلب اشتراك', callback_data: 'user_request_subscription' } ]] 
          };

          if (hasCourseAccess || hasSubjectAccess) {
              let message = `أهلاً بك، أنت مشترك بالفعل.\n\n`;
              message += `هذا هو ID الخاص بك (استخدمه لتسجيل الدخول في التطبيق):\n<code>${userId}</code>\n\n`;
              message += `اشتراكك الحالي:`;
              
              if (hasCourseAccess) {
                  message += `\n\n💎 الكورسات الكاملة:`;
                  courseAccess.forEach(access => {
                      if (access.courses) message += `\n- 📦 ${access.courses.title}`;
                  });
              }
              if (hasSubjectAccess) {
                  message += `\n\n🔒 المواد المحددة:`;
                  subjectAccess.forEach(access => {
                      if (access.subjects) message += `\n- 📖 ${access.subjects.title}`;
                  });
              }
              
              message += `\n\nيمكنك طلب اشتراك إضافي من الزر أدناه.`;
              await sendMessage(chatId, message, requestButtonKeyboard, 'HTML', true);

          } else {
            await sendMessage(chatId, 'أنت غير مشترك في الخدمة. يمكنك طلب اشتراك من الزر أدناه.', requestButtonKeyboard, null, true);
          }
        }
        return res.status(200).send('OK');
      }

      // أمر /cancel
      // أمر /cancel
      if (text === '/cancel') {
         await setUserState(userId, null, null); // (تنظيف الحالة دائماً)
         
         if (user.is_admin) {
            // (للأدمن: أرسل رسالة "تم" ثم قم بتعديلها إلى القائمة الرئيسية)
            
            // (أولاً، احذف أمر /cancel الذي أرسله الأدمن)
            try { await axios.post(`${TELEGRAM_API}/deleteMessage`, { chat_id: chatId, message_id: message.message_id }); } catch(e){}

            // 1. إرسال الرسالة المؤقتة
            const sentMessageResponse = await sendMessage(chatId, '👍 تم إلغاء العملية...');
            
            // 2. التحقق من أن الرسالة أُرسلت بنجاح
            if (sentMessageResponse && sentMessageResponse.data && sentMessageResponse.data.result) {
                const newMessageId = sentMessageResponse.data.result.message_id;
                
                // 3. تعديل الرسالة المؤقتة إلى القائمة الرئيسية
                // (نعطيها تأخير بسيط جداً 500ms ليلاحظ المستخدم "تم الإلغاء" قبل أن تختفي)
                await new Promise(resolve => setTimeout(resolve, 500)); 
                await sendAdminMenu(chatId, user, newMessageId);
            
            } else {
                // (خطة بديلة إذا فشل إرسال الرسالة الأولى)
                await sendAdminMenu(chatId, user);
            }
            
         } else {
            // (للمستخدم العادي: أرسل رسالة "تم" فقط)
            await sendMessage(chatId, '👍 تم إلغاء العملية.', null, null, true);
         }
         
         return res.status(200).send('OK');
      }
      
      // --- [ معالجة الحالات (State Machine) ] ---
      
      const currentState = user.admin_state; 
      const stateData = user.state_data || {};
      messageId = stateData.message_id; // (ID الرسالة التي يجب تعديلها)

      // (1. حالات المستخدم العادي - إرسال صورة)
      // (1. حالات المستخدم العادي - إرسال صورة)
      if (!user.is_admin && currentState === 'awaiting_payment_proof') {
        if (!message.photo) {
            await sendMessage(chatId, 'الرجاء إرسال صورة فقط (Screenshot) كإثبات. أعد المحاولة أو اضغط /cancel', null, null, true);
            return res.status(200).send('OK');
        }
        
        const stateData = user.state_data;
        // [ ✅ تعديل: التحقق من السعر ]
        if (!stateData.request_type || !stateData.items || !stateData.description || typeof stateData.total_price === 'undefined') {
            await sendMessage(chatId, 'حدث خطأ. بيانات الطلب (أو السعر) مفقودة. ابدأ من جديد بالضغط على /start', null, null, true);
            await setUserState(userId, null, null);
            return res.status(200).send('OK');
        }
        
        const payment_file_id = message.photo[message.photo.length - 1].file_id;
        const user_name = `${from.first_name || ''} ${from.last_name || ''}`.trim();
        const user_username = from.username || null;
        
        const courseTitleDesc = stateData.description;
        const totalPrice = stateData.total_price;
        
        let requested_items_data = [];
        if (stateData.request_type === 'course') {
             requested_items_data = stateData.items.map(item => ({ type: 'course', id: item.id, price: item.price }));
        } else if (stateData.request_type === 'subject') {
             requested_items_data = stateData.items.map(item => ({ type: 'subject', id: item.id, price: item.price }));
        }

        const { data: newRequest, error: insertError } = await supabase
            .from('subscription_requests')
            .insert({
                user_id: userId, user_name: user_name, user_username: user_username,
                course_title: courseTitleDesc,
                requested_data: requested_items_data,
                payment_file_id: payment_file_id,
                status: 'pending',
                total_price: totalPrice // [ ✅ تعديل: حفظ السعر الإجمالي ]
            })
            .select().single();

        if (insertError) {
            await sendMessage(chatId, `حدث خطأ أثناء حفظ طلبك: ${insertError.message}`, null, null, true);
            return res.status(200).send('OK');
        }
        await sendMessage(chatId, '✅ تم استلام طلبك بنجاح. سيقوم الأدمن بمراجعته والرد عليك قريباً.', null, null, true);
        await notifyAdminsOfNewRequest(newRequest);
        await setUserState(userId, null, null);
        
        return res.status(200).send('OK');
      }
      // (2. حالات الأدمن - إدخال نصي)
      if (user.is_admin && currentState) {
        
        // (حذف الرسالة النصية للأدمن لتبقى الواجهة نظيفة)
        try { await axios.post(`${TELEGRAM_API}/deleteMessage`, { chat_id: chatId, message_id: message.message_id }); } catch(e){}

        switch (currentState) {
            
          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await editMessage(chatId, messageId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            
            const { data: coursesData } = await supabase.from('courses').select('id, title, sort_order').order('sort_order');
            if (!coursesData || coursesData.length === 0) {
                 await editMessage(chatId, messageId, 'لا توجد كورسات. أضف كورسات أولاً.');
                 await setUserState(userId, null, null);
                 return res.status(200).send('OK');
            }
            
            const initialState = { users: ids, step: 1, courses: coursesData, selected_subjects: [] };
            await editMessage(chatId, messageId, `تم تحديد ${ids.length} مستخدم. جار تحميل الكورسات...`);
            await sendGrantUser_Step1_SelectCourse(chatId, messageId, initialState);
            break;
            
          case 'awaiting_device_reset_id':
            const resetIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (resetIds.length === 0) {
                await editMessage(chatId, messageId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
                return res.status(200).send('OK');
            }
            const { error: deleteError } = await supabase.from('devices').delete().in('user_id', resetIds);
            if (deleteError) { await editMessage(chatId, messageId, `حدث خطأ: ${deleteError.message}`); } 
            else { await editMessage(chatId, messageId, `✅ تم حذف البصمات لـ ${resetIds.length} مستخدم.`); }
            await setUserState(userId, null, null);
            break;
            
          case 'awaiting_user_id_for_revoke':
            const revokeIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (revokeIds.length !== 1) {
                 await editMessage(chatId, messageId, 'خطأ. هذه الميزة تعمل لمستخدم واحد فقط. أرسل ID واحد.');
                 return res.status(200).send('OK');
            }
            const targetUserId = revokeIds[0];
            await editMessage(chatId, messageId, `جاري جلب صلاحيات ${targetUserId}...`);
            await sendRevokeMenu(chatId, targetUserId, messageId);
            break;

          // (حالات إدارة المحتوى)
          case 'awaiting_course_title':
            await setUserState(userId, 'awaiting_course_price', { ...stateData, title: text });
            await editMessage(chatId, messageId, `👍 الاسم: "${text}"\n\nالآن أرسل "سعر" الكورس (للاشتراك الكامل) (أو 0 للمجاني):`);
            break;

          // [ ✅ جديد: حالة سعر الكورس ]
          case 'awaiting_course_price':
            const coursePrice = parseInt(text.trim(), 10);
            if (isNaN(coursePrice) || coursePrice < 0) {
                await editMessage(chatId, messageId, 'خطأ: السعر يجب أن يكون رقماً (0 أو أكبر). أرسل السعر (أو /cancel):');
                return res.status(200).send('OK');
            }
            
            await supabase.from('courses').insert({ 
                title: stateData.title, 
                price: coursePrice,
                sort_order: 0 
            });
            
            // [ ✅ إصلاح 1: عدم إرسال رسالة جديدة ]
            // (سنقوم فقط بتحديث القائمة، وهذا هو التأكيد)
            await sendContentMenu_Courses(chatId, messageId);
            break;
            
          // [ ✅ تعديل: حالة إضافة المادة (خطوتين) ]
          case 'awaiting_subject_title':
            await setUserState(userId, 'awaiting_subject_price', { ...stateData, title: text });
            await editMessage(chatId, messageId, `👍 الاسم: "${text}"\n\nالآن أرسل "سعر" المادة (للاشتراك المحدد) (أو 0 للمجاني):`);
            break;

          // [ ✅ جديد: حالة سعر المادة ]
          // [ ✅ جديد: حالة سعر المادة ]
          case 'awaiting_subject_price':
            const subjectPrice = parseInt(text.trim(), 10);
            if (isNaN(subjectPrice) || subjectPrice < 0) {
                await editMessage(chatId, messageId, 'خطأ: السعر يجب أن يكون رقماً (0 أو أكبر). أرسل السعر (أو /cancel):');
                return res.status(200).send('OK');
            }

            const { data: newSubject, error } = await supabase.from('subjects').insert({ 
                title: stateData.title, // (الاسم الصحيح من الحالة)
                price: subjectPrice,
                course_id: stateData.course_id, 
                sort_order: 0 
            }).select().single();
            
            if (error || !newSubject) {
                 await editMessage(chatId, messageId, `خطأ: ${error.message}`);
                 await sendContentMenu_Subjects(chatId, messageId, stateData.course_id);
                 break;
            }
            
            // (الانتقال لسؤال نسخ الصلاحيات)
            const newSubjectId = newSubject.id;
            const kbd = { inline_keyboard: [
                [{ text: '📖 نعم، نسخ الصلاحيات', callback_data: `copy_perms_start_${newSubjectId}` }],
                [{ text: '❌ لا، شكراً (تخطي)', callback_data: `copy_perms_skip_${newSubjectId}` }]
            ]};
            
            // [ ✅✅ الإصلاح هنا: استخدام stateData.title بدلاً من text ]
            await editMessage(chatId, messageId, `✅ تم إضافة المادة "${stateData.title}" بسعر ${subjectPrice}.\n\nهل تريد نسخ صلاحيات المستخدمين إليها من مادة أخرى موجودة؟`, kbd);
            break;
            
          // [ ✅ تعديل: إصلاح رسالة إضافة الشابتر ]
          case 'awaiting_chapter_title':
            await supabase.from('chapters').insert({ 
                title: text, 
                subject_id: stateData.subject_id, 
                sort_order: 0 
            });
            // [ ✅ إصلاح 1: عدم إرسال رسالة جديدة ]
            await sendContentMenu_Chapters(chatId, messageId, stateData.subject_id);
            break;
            
          case 'awaiting_video_title':
            await setUserState(userId, 'awaiting_youtube_id', { 
                ...stateData,
                video_title: text 
            });
            await editMessage(chatId, messageId, `👍 العنوان: "${text}"\n\nالآن أرسل "رابط يوتيوب" الخاص بالفيديو:`);
            break;
            
          case 'awaiting_youtube_id':
            const videoId = getYouTubeID(text);
            if (!videoId) {
                await editMessage(chatId, messageId, 'خطأ: الرابط غير صالح. أرسل رابط يوتيوب صحيح أو /cancel');
                break;
            }
            await supabase.from('videos').insert({ 
                title: stateData.video_title,
                youtube_video_id: videoId,
                chapter_id: stateData.chapter_id,
                sort_order: 0
            });
            // [ ✅ إصلاح 1: عدم إرسال رسالة جديدة ]
            await sendContentMenu_Videos(chatId, messageId, stateData.chapter_id);
            break;
            
          // (حالة الترتيب)
          // (حالة الترتيب)
          // (حالة الترتيب)
          case 'awaiting_sort_order':
             const lines = text.split('\n');
             const updates = [];
             for (const line of lines) {
                 const parts = line.split(',');
                 if (parts.length === 2) {
                     const id = parseInt(parts[0].trim(), 10);
                     const order = parseInt(parts[1].trim(), 10);
                     if (!isNaN(id) && !isNaN(order)) {
                         updates.push({ id: id, sort_order: order });
                     }
                 }
             }
             
             if (updates.length === 0) {
                 await editMessage(chatId, messageId, 'لم أتعرف على التنسيق. الرجاء المحاولة مرة أخرى أو /cancel');
                 break;
             }
             
             let updateError = null;
             let successCount = 0;
             for (const item of updates) {
                // [ ✅✅ الإصلاح هنا: إزالة الـ "_" الزائدة ]
                const { data, error } = await supabase
                    .from(stateData.item_type)
                    .update({ sort_order: item.sort_order })
                    .eq('id', item.id)
                    .select(); // (اطلب إرجاع البيانات للتأكد من نجاح التحديث)
                
                if (error) {
                    console.error(`Failed to update item ${item.id}:`, error);
                    updateError = error; // (احفظ آخر خطأ)
                } else if (data && data.length > 0) {
                    successCount++; // (تم التحديث بنجاح)
                }
             }

             if (updateError) {
                 await sendMessage(chatId, `حدث خطأ جزئي: ${updateError.message}. تم تحديث ${successCount} عنصر فقط.`);
             } else {
                 await sendMessage(chatId, `✅ تم تحديث ترتيب ${successCount} عنصر بنجاح.`);
             }
             
             // (العودة للقائمة السابقة)
             const navCallback = stateData.nav_callback;
             await setUserState(userId, null, null); // (تنظيف الحالة قبل العودة)
             
             if (navCallback === 'admin_manage_content') {
                 await sendContentMenu_Courses(chatId, messageId);
             } else if (navCallback.startsWith('content_nav_course_')) {
                 const courseId = parseInt(navCallback.split('_')[3], 10);
                 await sendContentMenu_Subjects(chatId, messageId, courseId);
             } else if (navCallback.startsWith('content_nav_subject_')) {
                 const subjectId = parseInt(navCallback.split('_')[3], 10);
                 await sendContentMenu_Chapters(chatId, messageId, subjectId);
             } else if (navCallback.startsWith('content_nav_chapter_')) {
                 const chapterId = parseInt(navCallback.split('_')[3], 10);
                 await sendContentMenu_Videos(chatId, messageId, chapterId);
             }
             break;
             
          // [ ✅ جديد: حالات تعديل السعر ]
          // [ ✅ جديد: حالات تعديل السعر ]
          case 'awaiting_course_new_price':
             const newCoursePrice = parseInt(text.trim(), 10);
             if (isNaN(newCoursePrice) || newCoursePrice < 0) {
                 await editMessage(chatId, messageId, 'خطأ: السعر يجب أن يكون رقماً (0 أو أكبر). أرسل السعر (أو /cancel):');
                 return res.status(200).send('OK');
             }
             await supabase.from('courses').update({ price: newCoursePrice }).eq('id', stateData.course_id);
             
             // [ ✅✅ الإصلاح: حذف السطر المسبب للخطأ ]
             // (السطر التالي تم حذفه لأنه يخص الأزرار فقط)
             // await answerCallbackQuery(callback_query.id, { text: '✅ تم تحديث سعر الكورس' });
             
             await sendContentMenu_Subjects(chatId, messageId, stateData.course_id); // (العودة لقائمة المواد)
             break;
             
          case 'awaiting_subject_new_price':
             const newSubjectPrice = parseInt(text.trim(), 10);
             if (isNaN(newSubjectPrice) || newSubjectPrice < 0) {
                 await editMessage(chatId, messageId, 'خطأ: السعر يجب أن يكون رقماً (0 أو أكبر). أرسل السعر (أو /cancel):');
                 return res.status(200).send('OK');
             }
             await supabase.from('subjects').update({ price: newSubjectPrice }).eq('id', stateData.subject_id);

             // [ ✅✅ الإصلاح: حذف السطر المسبب للخطأ ]
             // (السطر التالي تم حذفه لأنه يخص الأزرار فقط)
             // await answerCallbackQuery(callback_query.id, { text: '✅ تم تحديث سعر المادة' });
             
             await sendContentMenu_Chapters(chatId, messageId, stateData.subject_id); // (العودة لقائمة الشباتر)
             break;

          // (حالة الرفض)
          // [ ✅✅ تعديل: تغيير منطق الرفض ]
          case 'awaiting_rejection_reason':
            if (!text || text.trim().length === 0) {
                await sendMessage(chatId, 'الرجاء إرسال سبب واضح (نص).');
                return res.status(200).send('OK');
            }
            if (!stateData.request_id || !stateData.target_user_id) {
                 await sendMessage(chatId, 'خطأ: الحالة مفقودة. تم الإلغاء.');
                 await setUserState(userId, null, null);
                 return res.status(200).send('OK');
            }
            
            // 1. إبلاغ المستخدم بالرفض
            const userMessage = `نأسف، تم رفض طلب اشتراكك.\n\nالسبب: ${text}`;
            await sendMessage(stateData.target_user_id, userMessage, null, null, true);
            
            // 2. تحديث قاعدة البيانات
            await supabase.from('subscription_requests').update({ status: 'rejected' }).eq('id', stateData.request_id);

            // 3. [ ✅ تعديل: إخفاء الأزرار وتعديل الكابشن لرسالة الصورة ]
            try {
                const newCaption = stateData.original_caption + 
                                   `\n\n<b>❌ تم الرفض بواسطة:</b> ${from.first_name || 'Admin'}\n<b>السبب:</b> ${text}`;
                await axios.post(`${TELEGRAM_API}/editMessageCaption`, {
                      chat_id: chatId,
                      message_id: stateData.admin_message_id, // (ID رسالة الصورة)
                      caption: newCaption,
                      parse_mode: 'HTML',
                      reply_markup: null // (إزالة الأزرار)
                });
            } catch(e) { 
                 console.warn("Could not edit photo caption/markup:", e.message);
            }

            // 4. [ ✅ تعديل: إرسال رسالة تأكيد "جديدة" مع أزرار ]
            const confirmationKeyboard = { inline_keyboard: [
                [
                    { text: '🔙 رجوع (للطلبات)', callback_data: 'admin_view_requests' },
                    { text: '🏠 الرئيسية', callback_data: 'admin_main_menu' }
                ]
            ]};
            await sendMessage(chatId, '❌ تم إرسال الرفض والملاحظة للمستخدم بنجاح.', confirmationKeyboard);
            
            // 5. تنظيف الحالة
            await setUserState(userId, null, null);
            break;

          // (حالات إضافة/إزالة المشرفين)
          case 'awaiting_admin_id_to_add':
          case 'awaiting_admin_id_to_remove':
              if (String(user.id) !== MAIN_ADMIN_ID) return res.status(200).send('OK');
              const idToModify = text.trim();
              if (!/^\d+$/.test(idToModify)) {
                  await editMessage(chatId, messageId, 'خطأ. أرسل ID رقمي صالح.');
                  return res.status(200).send('OK');
              }
              if (idToModify === MAIN_ADMIN_ID && currentState === 'awaiting_admin_id_to_remove') {
                  await editMessage(chatId, messageId, 'لا يمكنك إزالة الأدمن الرئيسي.');
                  return res.status(200).send('OK');
              }
              
              const isAdding = currentState === 'awaiting_admin_id_to_add';
              const newAdminStatus = isAdding;
              const { data: userToModify, error: findError } = await supabase.from('users').select('id, is_admin').eq('id', idToModify).single();

              if (findError || !userToModify) {
                  await editMessage(chatId, messageId, 'خطأ: هذا الـ ID غير موجود. يجب على المستخدم تشغيل البوت (/start) أولاً.');
                  return res.status(200).send('OK');
              }
              if (userToModify.is_admin === newAdminStatus) {
                  await editMessage(chatId, messageId, `المستخدم ${idToModify} هو ${isAdding ? 'مشرف بالفعل' : 'ليس مشرفاً أصلاً'}.`);
                  await sendAdminManagementMenu(chatId, messageId);
                  return res.status(200).send('OK');
              }

              await supabase.from('users').update({ is_admin: newAdminStatus }).eq('id', idToModify);
              await editMessage(chatId, messageId, `✅ تم ${isAdding ? 'ترقية' : 'إزالة'} المستخدم ${idToModify} ${isAdding ? 'إلى مشرف' : 'من المشرفين'}.`);
              await sendAdminManagementMenu(chatId, messageId);
              break;
              
          default:
            console.warn(`Unhandled state: ${currentState}`);
            await setUserState(userId, null, null);
            await sendMessage(chatId, 'حالة غير معروفة، تم الإلغاء.');
            break;
        } // نهاية الـ switch

        return res.status(200).send('OK');
      } // (نهاية if user.is_admin && currentState)

      // رسالة عامة (إذا لم يكن في أي حالة)
      if (!currentState) {
        console.log(`Ignoring non-command text from user ${userId}`);
      }
    } // (نهاية if message && message.from)
    
  } catch (e) {
    console.error("Error in webhook:", e.response ? e.response.data : e.message, e.stack);
    if (chatId) {
        try {
           await sendMessage(chatId, `حدث خطأ جسيم في الخادم: ${e.message}`, null, null, true);
        } catch (sendError) {
             console.error("Failed to send critical error message:", sendError);
        }
    }
  } // (نهاية try...catch الرئيسي)

  res.status(200).send('OK');
};
