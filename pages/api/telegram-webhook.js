// pages/api/telegram-webhook.js
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- الدوال المساعدة (Escape و YouTube ID) ---
// (دالة escapeMarkdown موجودة احتياطاً، لكننا لن نستخدمها)
const escapeMarkdown = (text) => {
  if (text === null || typeof text === 'undefined') return '';
  const str = String(text);
  return str.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
};
// --- [ ✅✅ دوال جديدة: قسم الإشراف ] ---

// --- [ (دالة مساعدة) ] ---

// [ ✅✅ تعديل: قائمة تعديل المشرفين أصبحت ديناميكية ]
const sendAdminManagementMenu = async (chatId) => {
   
   // 1. جلب المشرفين الحاليين
   const { data: admins, error } = await supabase
       .from('users')
       .select('id')
       .eq('is_admin', true);
   
   let message = 'إدارة المشرفين:\n\n';
   const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID;

   if (error) {
       message += 'خطأ في جلب قائمة المشرفين.';
   } else if (!admins || admins.length === 0) {
       message += 'لا يوجد مشرفون حالياً.';
   } else {
       message += 'المشرفون الحاليون:\n';
       admins.forEach(admin => {
           if (String(admin.id) === MAIN_ADMIN_ID) {
               message += `👑 ${admin.id} (الأدمن الرئيسي)\n`;
           } else {
               message += `👮‍♂️ ${admin.id}\n`;
           }
       });
   }
   message += '\nاختر الإجراء الذي تريده:';
   // --- [ نهاية جلب القائمة ] ---

   const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة مشرف جديد', callback_data: 'admin_add_admin' }],
      [{ text: '➖ إزالة مشرف', callback_data: 'admin_remove_admin' }],
      [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }],
    ],
  };
  
  // 2. إرسال الرسالة الجديدة
  await sendMessage(chatId, message, keyboard);
};

// (دالة جلب وعرض الإحصائيات)
const sendStatistics = async (chatId) => {
    try {
        await sendMessage(chatId, 'جاري حساب الإحصائيات، يرجى الانتظار...');

        // 1. إجمالي المستخدمين
        const { count: totalUsers, error: totalError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        if (totalError) throw new Error(`Total Users Error: ${totalError.message}`);

        // 2. المشتركون (الاشتراك الشامل)
        const { count: fullSubscribers, error: fullSubError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_subscribed', true);
        if (fullSubError) throw new Error(`Full Subscribers Error: ${fullSubError.message}`);
        
        // 3. المشتركون (اشتراك محدد - لكل كورس)
        const { data: specificSubs, error: specificSubError } = await supabase
            .from('user_course_access')
            .select('courses ( title )'); // جلب عنوان الكورس المرتبط
        if (specificSubError) throw new Error(`Specific Subs Error: ${specificSubError.message}`);

        // (معالجة إحصائيات الكورسات المحددة)
        const courseCounts = {};
        let totalSpecificSubs = 0;
        if (specificSubs) {
            totalSpecificSubs = specificSubs.length;
            specificSubs.forEach(sub => {
                const title = sub.courses ? sub.courses.title : 'كورس محذوف';
                courseCounts[title] = (courseCounts[title] || 0) + 1;
            });
        }

        // 4. بناء الرسالة
        let message = `📊 إحصائيات البوت:\n\n`;
        message += `👤 إجمالي المستخدمين المسجلين: ${totalUsers}\n\n`;
        message += `--- [ الاشتراكات ] ---\n`;
        message += `💎 (الاشتراك الشامل): ${fullSubscribers} مشترك\n`;
        message += `🔒 (الاشتراكات المحددة): ${totalSpecificSubs} اشتراك (موزعة كالتالي):\n`;

        if (Object.keys(courseCounts).length > 0) {
            for (const [title, count] of Object.entries(courseCounts)) {
                message += `  - ${title}: ${count} مشترك\n`;
            }
        } else {
            message += `  (لا توجد اشتراكات محددة)\n`;
        }

        await sendMessage(chatId, message);

    } catch (error) {
        console.error("Error in sendStatistics:", error);
        await sendMessage(chatId, `حدث خطأ أثناء جلب الإحصائيات: ${error.message}`);
    }
};
// --- [ نهاية الدوال الجديدة ] ---
const getYouTubeID = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=|\?v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) return match[2];
  if (url.length === 11) return url;
  return null;
};

// --- دوال إرسال الرسائل ---

/**
 * [ ✅ إصلاح: الافتراضي هو نص عادي ]
 * دالة إرسال الرسائل الرئيسية
 * @param {string} parse_mode - (اختياري) 'HTML' أو 'MarkdownV2'
 */
const sendMessage = async (chatId, text, reply_markup = null, parse_mode = null, protect_content = false) => {
    if (!text || text.trim() === '') {
        console.warn(`Attempted to send empty message to chat ID: ${chatId}`);
        return;
    }
    
    const processedText = (parse_mode === 'MarkdownV2') ? escapeMarkdown(text) : text;
    
    const payload = {
        chat_id: chatId,
        text: processedText,
        protect_content: protect_content
    };
    
    if (reply_markup) payload.reply_markup = reply_markup;
    if (parse_mode) payload.parse_mode = parse_mode; // لن يتم إرساله إذا كان null
    
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
    } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error.response?.data || error.message);
        
        if (error.response && error.response.data && error.response.data.description.includes("can't parse entities")) {
            console.warn(`Markdown parsing failed for chat ${chatId}. Resending as plain text.`);
            const retryPayload = { ...payload, text: text };
            delete retryPayload.parse_mode;
            try {
                await axios.post(`${TELEGRAM_API}/sendMessage`, retryPayload);
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
            parse_mode: 'HTML', // HTML هنا مقصود
            ...(reply_markup && { reply_markup }),
            protect_content: false 
        });
    } catch (error) {
         console.error(`Failed to send photo to chat ${chatId}:`, error.response?.data || error.message);
    }
};

// دالة الرد على Callback Query
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

// --- دوال إدارة قواعد البيانات (المستخدم والحالة) ---

// (يستخدم 'admin_state')
const getUser = async (userId) => {
  const selectQuery = 'id, is_subscribed, is_admin, admin_state, state_data';
  let userData = null;
  try {
      const { data, error } = await supabase.from('users').select(selectQuery).eq('id', userId).single();
      if (error && error.code === 'PGRST116') {
          const newUser = { id: userId, is_subscribed: false, is_admin: false };
          const { data: insertedUser, error: insertError } = await supabase.from('users').insert(newUser).select(selectQuery).single();
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

// (يستخدم 'admin_state')
const setUserState = async (userId, state, data = null) => {
  try {
    await supabase.from('users').update({ admin_state: state, state_data: data }).eq('id', userId);
  } catch(e) {
      console.error("Failed to set user state:", e.message);
  }
};

// --- دوال الأدمن: القوائم الرئيسية ---

// --- [ (دالة مساعدة) ] ---
// --- [ (دالة مساعدة) ] ---
// [ ✅✅ تعديل: دمج "الإحصائيات" و "تعديل المشرفين" في القائمة الرئيسية ]
const sendAdminMenu = async (chatId, user) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '📨 طلبات الاشتراك', callback_data: 'admin_view_requests' }],
      [{ text: '👤 إدارة المستخدمين', callback_data: 'admin_manage_users' }],
      [{ text: '🗂️ إدارة المحتوى', callback_data: 'admin_manage_content' }],
      [{ text: '📊 الإحصائيات', callback_data: 'admin_stats' }] // <-- (متاح لكل المشرفين)
    ],
  };

  // [ ✅✅ جديد: التحقق من الأدمن الرئيسي ]
  const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID;
  if (MAIN_ADMIN_ID && String(user.id) === MAIN_ADMIN_ID) {
    // إضافة زر "تعديل المشرفين" فقط للأدمن الرئيسي
    keyboard.inline_keyboard.push([
      { text: '👑 تعديل المشرفين', callback_data: 'admin_manage_admins' }
    ]);
  }
  // --- [ نهاية التعديل ] ---

  await sendMessage(chatId, 'Panel Admin:\nاختر القسم:', keyboard);
};
  // --- [ نهاية التعديل ] ---



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
    await sendMessage(chatId, 'خطأ: لم يتم العثور على كورسات. أضف كورسات أولاً.');
    await setUserState(chatId, null, null);
    return;
  }
  await setUserState(chatId, 'awaiting_course_selection', stateData);
  const keyboard = courses.map(c => ([{ text: c.title, callback_data: `${callback_prefix}_${c.id}` }]));
  if (callback_prefix === 'assign_course') {
     keyboard.unshift([{ text: '✅ منح صلاحية لكل الكورسات', callback_data: 'assign_all_courses' }]);
     keyboard.push([{ text: '👍 إنهاء ومنح الصلاحيات المحددة', callback_data: 'assign_finish' }]);
  }
  await sendMessage(chatId, text, { inline_keyboard: keyboard });
};

const sendRevokeMenu = async (adminChatId, targetUserId) => {
  try {
    const { data: targetUser, error: userError } = await supabase.from('users').select('is_subscribed').eq('id', targetUserId).single();
    if (userError && userError.code === 'PGRST116') {
      await sendMessage(adminChatId, `خطأ: المستخدم ${targetUserId} غير موجود.`);
      return;
    }
    if (userError) throw userError;
    const { data: accessData, error: accessError } = await supabase.from('user_course_access').select('course_id').eq('user_id', targetUserId);
    if (accessError) throw accessError;
    let courses = [];
    if (accessData && accessData.length > 0) {
      const courseIds = accessData.map(a => a.course_id);
      const { data: coursesData, error: coursesError } = await supabase.from('courses').select('id, title').in('id', courseIds);
      if (coursesError) throw coursesError;
      courses = coursesData;
    }
    // [ ✅ إصلاح: نص عادي ]
    let message = `مراجعة صلاحيات المستخدم: ${targetUserId}\n\n`;
    message += targetUser.is_subscribed ? "الحالة: 💎 مشترك (صلاحية كاملة)\n" : "الحالة: 🔒 صلاحية محددة\n";
    const keyboard = [];
    if (courses.length > 0) {
      message += "الكورسات المحددة:\n";
      courses.forEach(course => {
        message += `- ${course.title}\n`;
        keyboard.push([{ text: `❌ سحب [${course.title}]`, callback_data: `revoke_specific_${targetUserId}_course_${course.id}`}]);
      });
    } else {
      message += "لا يمتلك صلاحية لأي كورس محدد.\n";
    }
    keyboard.unshift([{ text: '⛔️ سحب "جميع" الصلاحيات', callback_data: `revoke_all_${targetUserId}`}]);
    keyboard.push([{ text: '🔙 رجوع (إلغاء)', callback_data: 'admin_manage_users' }]);
    await sendMessage(adminChatId, message, { inline_keyboard: keyboard });
  } catch (error) {
    console.error("Error in sendRevokeMenu:", error);
    await sendMessage(adminChatId, `حدث خطأ: ${error.message}`);
    await setUserState(adminChatId, null, null);
  }
};

// --- دوال الأدمن: إدارة المحتوى الهرمية ---

const sendContentMenu_Courses = async (chatId) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error) {
    await sendMessage(chatId, `خطأ في جلب الكورسات: ${error.message}`);
    return;
  }
  const keyboard = [];
  if (courses && courses.length > 0) {
    courses.forEach(course => {
      keyboard.push([{ text: `📚 ${course.title}`, callback_data: `content_nav_course_${course.id}`}]);
    });
  }
  keyboard.push([{ text: '➕ إضافة كورس جديد', callback_data: 'content_add_course' }]);
  keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'admin_main_menu' }]);
  await setUserState(chatId, null, null);
  await sendMessage(chatId, 'إدارة المحتوى: (الكورسات)\n\nاختر كورساً للتعديل أو أضف كورساً جديداً:', { inline_keyboard: keyboard });
};

const sendContentMenu_Folders = async (chatId, courseId) => {
  const { data: course, error } = await supabase.from('courses').select('title, sections (id, title)').eq('id', courseId).single();
  if (error || !course) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على الكورس.');
    return;
  }
  const courseTitle = course.title;
  const sections = course.sections || [];
  const keyboard = [];
  sections.forEach(section => {
    keyboard.push([{ text: `📁 ${section.title}`, callback_data: `content_nav_folder_${section.id}`}]);
  });
  keyboard.push([
    { text: '➕ إضافة مجلد', callback_data: `content_add_folder_${courseId}` },
    { text: '❌ حذف مجلد', callback_data: `content_del_folder_${courseId}` }
  ]);
  keyboard.push([{ text: '🗑️ حذف هذا الكورس بالكامل', callback_data: `delete_course_confirm_${courseId}` }]);
  keyboard.push([{ text: '🔙 رجوع (للكورسات)', callback_data: 'admin_manage_content' }]);
  await setUserState(chatId, null, null);
  await sendMessage(chatId, `الكورس: ${courseTitle}\n\nاختر مجلداً للتعديل أو أضف مجلداً جديداً:`, { inline_keyboard: keyboard });
};

const sendContentMenu_Videos = async (chatId, sectionId) => {
  const { data: section, error } = await supabase.from('sections').select('title, course_id, videos (id, title)').eq('id', sectionId).single();
  if (error || !section) {
    await sendMessage(chatId, 'خطأ: لم يتم العثور على المجلد.');
    return;
  }
  const sectionTitle = section.title;
  const courseId = section.course_id;
  const videos = section.videos || [];
  const keyboard = [];
  videos.forEach(video => {
    keyboard.push([{ text: `▶️ ${video.title}`, callback_data: `content_del_video_${video.id}_${sectionId}`}]);
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
  await sendMessage(chatId, `المجلد: ${sectionTitle}\n\nاختر فيديو لحذفه أو أضف فيديو جديد:`, { inline_keyboard: keyboard });
};

// [ ✅✅ جديد: دالة قائمة حذف المجلدات ]
const sendContentMenu_DeleteFolder = async (chatId, courseId) => {
    const { data: sections, error } = await supabase
        .from('sections')
        .select('id, title')
        .eq('course_id', courseId)
        .order('title');
        
    if (error || !sections || sections.length === 0) {
        await sendMessage(chatId, 'لا توجد مجلدات لحذفها في هذا الكورس.');
        await sendContentMenu_Folders(chatId, courseId);
        return;
    }
    
    const keyboard = [];
    sections.forEach(section => {
        keyboard.push([{ 
            text: `🗑️ ${section.title}`, 
            callback_data: `confirm_del_folder_${section.id}_${courseId}` 
        }]);
    });
    
    keyboard.push([{ text: '🔙 رجوع (إلغاء الحذف)', callback_data: `content_nav_course_${courseId}` }]);
    
    await setUserState(chatId, null, null);
    await sendMessage(chatId, 'اختر المجلد الذي تريد حذفه (سيتم حذف جميع الفيديوهات بداخله):', { inline_keyboard: keyboard });
};


// --- دوال نظام طلبات الاشتراك ---

// [ ✅✅ جديد: دالة مساعدة لإنشاء قائمة الكورسات ]
/**
 * يبني لوحة الأزرار الديناميكية لاختيار الكورسات
 * @param {Array} allCourses - قائمة بكل الكورسات من DB
 * @param {Array} selectedCourses - الكورسات المختارة حالياً من state_data
 */
const buildCoursesKeyboard = (allCourses, selectedCourses = []) => {
    const keyboard = [];
    
    // 1. زر الاشتراك الشامل
    const allSelected = selectedCourses.some(c => c.id === 'all');
    keyboard.push([{
        text: `${allSelected ? '✅' : ''} 📦 الاشتراك الشامل (كل الكورسات)`,
        callback_data: 'sub_req_toggle_all'
    }]);

    // 2. الكورسات الفردية (تظهر فقط إذا لم يتم اختيار "الشامل")
    if (!allSelected && allCourses && allCourses.length > 0) {
        allCourses.forEach(c => {
            const isSelected = selectedCourses.some(sel => sel.id === c.id);
            keyboard.push([{ 
                text: `${isSelected ? '✅' : ''} ${c.title}`, 
                // نستخدم فاصل | لتجنب مشاكل في اسم الكورس
                callback_data: `sub_req_toggle_${c.id}|${c.title}` 
            }]);
        });
    }

    // 3. زر التأكيد (يظهر فقط إذا كان هناك اختيار)
    if (selectedCourses.length > 0) {
         keyboard.push([{ text: '👍 تأكيد الإختيار والمتابعة', callback_data: 'sub_req_submit' }]);
    }
    
    // 4. زر الإلغاء
    keyboard.push([{ text: '🔙 إلغاء', callback_data: 'sub_req_cancel' }]);

    return { inline_keyboard: keyboard };
};


// [ ✅✅ تعديل: دالة عرض الكورسات للاشتراك ]
// --- [ ✅✅ تعديل: دالة عرض الكورسات للاشتراك (لتقوم بتعديل الرسالة) ] ---
const sendSubscriptionCourses = async (chatId, stateData = null, messageId = null) => {
  const { data: courses, error } = await supabase.from('courses').select('id, title').order('title');
  if (error) {
    await sendMessage(chatId, 'عذراً، حدث خطأ أثناء جلب الكورسات.', null, null, true);
    return;
  }
  
  const selected = stateData?.selected_courses || [];
  
  // (دالة buildCoursesKeyboard تبقى كما هي)
  const keyboard = buildCoursesKeyboard(courses, selected);
  
  // نضع المستخدم في "حالة اختيار"
  await setUserState(chatId, 'awaiting_course_selection', { selected_courses: selected });
  
  const messageText = selected.length === 0 ?
    'اختر الكورسات التي ترغب بالاشتراك بها، أو اطلب الاشتراك الشامل:' :
    'يمكنك اختيار أكثر من كورس. اضغط "تأكيد" عند الانتهاء:';
    
  // [ ✅✅ جديد: منطق تعديل الرسالة ]
  if (messageId) {
      // إذا كان لدينا ID رسالة، نقوم بتعديلها
      try {
          await axios.post(`${TELEGRAM_API}/editMessageText`, {
              chat_id: chatId,
              message_id: messageId,
              text: messageText,
              reply_markup: keyboard
          });
      } catch (e) {
          // (قد تفشل إذا لم يتغير النص، لا مشكلة)
          // (قد تفشل أيضاً إذا ضغط المستخدم بسرعة كبيرة جداً، لذا نحاول تعديل الأزرار فقط)
          try {
               await axios.post(`${TELEGRAM_API}/editMessageReplyMarkup`, {
                  chat_id: chatId,
                  message_id: messageId,
                  reply_markup: keyboard
              });
          } catch (e2) {
              // تجاهل الأخطاء الناتجة عن الضغط السريع
              // console.error("Failed to edit message markup:", e2.message);
          }
      }
  } else {
      // إذا لم يكن لدينا ID (أول مرة)، نرسل رسالة جديدة
      await sendMessage(chatId, messageText, keyboard, null, true);
  }
};


// --- [ (دالة مساعدة) ] ---
const notifyAdminsOfNewRequest = async (request) => {
    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
    if (!admins || admins.length === 0) return;
    
    let caption = `<b>🔔 طلب اشتراك جديد</b>\n\n` +
                  `<b>المستخدم:</b> ${request.user_name || 'غير متوفر'}\n` +
                  (request.user_username ? `<b>المعرف:</b> @${request.user_username}\n` : '') +
                  `<b>ID:</b> <code>${request.user_id}</code>\n\n` +
                  `<b>الطلب:</b>\n${request.course_title}`;
                  
    // [ ✅✅ تعديل: إضافة زر الرفض ]
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ موافقة', callback_data: `approve_sub_${request.id}` },
        { text: '❌ رفض', callback_data: `reject_sub_${request.id}` }
      ]]
    };
    // --- [ نهاية التعديل ] ---

    for (const admin of admins) {
      await sendPhotoMessage(admin.id, request.payment_file_id, caption, keyboard);
    }
};

// --- [ (دالة مساعدة) ] ---
const sendPendingRequests = async (chatId) => {
    const { data: requests, error } = await supabase.from('subscription_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (error || !requests || requests.length === 0) {
        await sendMessage(chatId, 'لا توجد طلبات اشتراك معلقة حالياً.');
        return;
    }
    await sendMessage(chatId, `يوجد ${requests.length} طلب اشتراك معلق:`);
    for (const request of requests) {
        let caption = `<b>🔔 طلب اشتراك معلق</b>\n\n` +
                      `<b>المستخدم:</b> ${request.user_name || 'غير متوفر'}\n` +
                      (request.user_username ? `<b>المعرف:</b> @${request.user_username}\n` : '') +
                      `<b>ID:</b> <code>${request.user_id}</code>\n\n` +
                      `<b>الطلب:</b>\n${request.course_title}`;
        
        // [ ✅✅ تعديل: إضافة زر الرفض ]
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ موافقة', callback_data: `approve_sub_${request.id}` },
            { text: '❌ رفض', callback_data: `reject_sub_${request.id}` }
          ]]
        };
        // --- [ نهاية التعديل ] ---

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
  let from; 

  try {
    const { message, callback_query } = req.body;

    // --- ( 1. معالجة الأزرار - Callback Query) ---
    if (callback_query) {
      chatId = callback_query.message.chat.id;
      userId = String(callback_query.from.id);
      from = callback_query.from; 
      user = await getUser(userId); // (يستخدم admin_state)
      const command = callback_query.data;
      
      // الرد أولاً لمنع "ساعة الانتظار"
      await answerCallbackQuery(callback_query.id);

      if (!user) {
          console.error("User not found on callback:", userId);
          return res.status(200).send('OK');
      }

      if(command === 'noop') return res.status(200).send('OK');

      // --- [ (مسار المستخدم العادي - ضغط الأزرار) ] ---
     // --- [ (داخل معالج callback_query) ] ---

      // --- [ (مسار المستخدم العادي - ضغط الأزرار) ] ---
     // --- [ (داخل معالج callback_query) ] ---

      // --- [ (مسار المستخدم العادي - ضغط الأزرار) ] ---
      if (!user.is_admin) {
        
        const currentState = user.admin_state;
        const messageId = callback_query.message.message_id; // جلب ID الرسالة

        // (1. المستخدم يضغط على "الاشتراك الشامل")
        if (command === 'sub_req_toggle_all') {
            const stateData = (currentState === 'awaiting_course_selection') ? (user.state_data || { selected_courses: [] }) : { selected_courses: [] };
            let selected = stateData.selected_courses || [];

            const isAllSelected = selected.some(c => c.id === 'all');
            if (isAllSelected) {
                selected = []; // إلغاء الاختيار
            } else {
                selected = [{ id: 'all', title: 'الاشتراك الشامل (كل الكورسات)' }]; // اختيار
            }
            await sendSubscriptionCourses(chatId, { selected_courses: selected }, messageId); // تعديل الرسالة
            return res.status(200).send('OK');
        }

        // (2. المستخدم يضغط على كورس محدد)
        if (command.startsWith('sub_req_toggle_')) {
            const stateData = (currentState === 'awaiting_course_selection') ? (user.state_data || { selected_courses: [] }) : { selected_courses: [] };
            let selected = stateData.selected_courses || [];

            // --- [ ✅✅✅ هذا هو الإصلاح ] ---
            // الكود السابق: const parts = command.split('_')[2].split('|');
            // الكود الصحيح:
            const dataString = command.substring('sub_req_toggle_'.length); // (e.g., "123|Course Title")
            const parts = dataString.split('|');
            // --- [ نهاية الإصلاح ] ---
            
            const courseId = parseInt(parts[0], 10);
            const courseTitle = parts[1]; // (الآن سيتم جلب الاسم بشكل صحيح)

            // التأكد من أن البيانات صحيحة
            if (isNaN(courseId) || !courseTitle) {
                 console.error("Callback data parsing error:", command);
                 await answerCallbackQuery(callback_query.id, { text: 'حدث خطأ، حاول مرة أخرى.' });
                 return res.status(200).send('OK');
            }

            if (selected.some(c => c.id === 'all')) {
                selected = []; // إلغاء الشامل
            }

            const index = selected.findIndex(c => c.id === courseId);
            if (index > -1) {
                selected.splice(index, 1); // إلغاء الاختيار
            } else {
                selected.push({ id: courseId, title: courseTitle }); // اختيار
            }
            
            await sendSubscriptionCourses(chatId, { selected_courses: selected }, messageId); // تعديل الرسالة
            return res.status(200).send('OK');
        }

        // (3. المستخدم يضغط "تأكيد الإختيار")
        if (command === 'sub_req_submit') {
             const stateData = (currentState === 'awaiting_course_selection') ? (user.state_data || { selected_courses: [] }) : { selected_courses: [] };
             let selected = stateData.selected_courses || [];

             if (selected.length === 0) {
                 await answerCallbackQuery(callback_query.id, { text: 'الرجاء اختيار كورس واحد على الأقل.' });
                 return res.status(200).send('OK');
             }
             
             await setUserState(userId, 'awaiting_payment_proof', { selected_courses: selected });
             
             // (الآن selected تحتوي على البيانات الصحيحة)
             const titles = selected.map(c => c.title).join('\n- ');
             
             try { await axios.post(`${TELEGRAM_API}/deleteMessage`, { chat_id: chatId, message_id: messageId }); } catch(e){}
             
             await sendMessage(
                chatId, 
                `لقد اخترت:\n- ${titles}\n\nالرجاء الآن إرسال صورة واحدة (Screenshot) تثبت عملية الدفع.`,
                null, null, true
             );
            return res.status(200).send('OK');
        }

        // (4. المستخدم يضغط "إلغاء")
        if (command === 'sub_req_cancel') {
            await setUserState(userId, null, null);
            try { await axios.post(`${TELEGRAM_API}/deleteMessage`, { chat_id: chatId, message_id: messageId }); } catch(e){}
            await sendMessage(chatId, 'تم إلغاء الطلب.', null, null, true);
            return res.status(200).send('OK');
        }

        // (5. المستخدم يضغط على الزر الرئيسي "طلب اشتراك")
        if (command === 'user_request_sif (command === 'admin_main_menu') {
        await setUserState(userId, null, null);
        await sendAdminMenu(chatId, user); // (تمرير user)
        return res.status(200).send('OK');
      }

      // [ ✅✅ جديد: معالج الإحصائيات (لكل المشرفين) ]
      if (command === 'admin_stats') {
          await sendStatistics(chatId); // (الدالة sendStatistics تبقى كما هي)
          return res.status(200).send('OK');
      }

      // [ ✅✅ تعديل: قسم الإشراف (للأدمن الرئيسي فقط) ]
      if (command === 'admin_manage_admins' || command === 'admin_add_admin' || command === 'admin_remove_admin') {
          // التحقق أولاً: هل هذا هو الأدمن الرئيسي؟
          if (String(user.id) !== process.env.MAIN_ADMIN_ID) {
              await answerCallbackQuery(callback_query.id, { text: 'هذا القسم للأدمن الرئيسي فقط.', show_alert: true });
              return res.status(200).send('OK');
          }
          
          
          if (command === 'admin_add_admin') {
              await setUserState(userId, 'awaiting_admin_id_to_add');
              await sendMessage(chatId, 'أرسل الـ ID الخاص بالمستخدم الذي تريد ترقيته لـ "مشرف": (أو /cancel)');
              return res.status(200).send('OK');
          }
          if (command === 'admin_remove_admin') {
              await setUserState(userId, 'awaiting_admin_id_to_remove');
              await sendMessage(chatId, 'أرسل الـ ID الخاص بالمشرف الذي تريد إزالته: (أو /cancel)');
              return res.status(200).send('OK');
          }
                }ubscription') {
            await sendSubscriptionCourses(chatId, null, null); 
            return res.status(200).send('OK');
        }

        await sendMessage(chatId, 'أنت لست أدمن.', null, null, true);
        return res.status(200).send('OK');
      }

// --- [ (نهاية التعديل - أكمل باقي كود الأدمن كما كان) ] ---

// --- [ (نهاية التعديل - أكمل باقي كود الأدمن كما كان) ] ---

      // --- [ (مسار الأدمن - ضغط الأزرار) ] ---
      
      // 1. التنقل الرئيسي للأدمن
      // --- [ (داخل معالج callback_query للأدمن) ] ---
      
      // 1. التنقل الرئيسي للأدمن
      
      // --- [ نهاية المعالجات الجديدة ] ---
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
        const courseId = parseInt(command.split('_')[3], 10);
        await sendContentMenu_DeleteFolder(chatId, courseId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('confirm_del_folder_')) {
        const sectionId = parseInt(command.split('_')[3], 10);
        const courseId = parseInt(command.split('_')[4], 10);
        await supabase.from('sections').delete().eq('id', sectionId);
        await sendMessage(chatId, '🗑️ تم حذف المجلد بنجاح.');
        await sendContentMenu_Folders(chatId, courseId);
        return res.status(200).send('OK');
      }

      if (command.startsWith('content_del_video_')) {
        const videoId = parseInt(command.split('_')[3], 10);
        const sectionId = parseInt(command.split('_')[4], 10);
        await supabase.from('videos').delete().eq('id', videoId);
        await sendMessage(chatId, '🗑️ تم حذف الفيديو. (جاري تحديث القائمة...)');
        await sendContentMenu_Videos(chatId, sectionId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('delete_course_confirm_')) {
        const courseId = parseInt(command.split('_')[3], 10);
        await supabase.from('courses').delete().eq('id', courseId);
        await sendMessage(chatId, `🗑️ تم حذف الكورس وكل محتوياته بنجاح.`);
        await sendContentMenu_Courses(chatId);
        return res.status(200).send('OK');
      }
      
      // 4. إدارة المستخدمين (الأوامر)
      if (command === 'admin_add_users') {
        await setUserState(userId, 'awaiting_user_ids');
        await sendMessage(chatId, '👤 أرسل الآن ID واحد أو أكثر (افصل بينهم بمسافة أو سطر جديد):');
        return res.status(200).send('OK');
      }
      if (command === 'admin_reset_device') {
        await setUserState(userId, 'awaiting_device_reset_id');
        await sendMessage(chatId, '👤 أرسل ID المستخدم (أو عدة IDs) الذي تريد حذف بصمته:');
        return res.status(200).send('OK');
      }
      if (command === 'admin_revoke_permissions') {
        await setUserState(userId, 'awaiting_user_id_for_revoke');
        await sendMessage(chatId, '👤 أرسل ID المستخدم الواحد الذي تريد مراجعة صلاحياته:');
        return res.status(200).send('OK');
      }
      if (command === 'assign_all_courses') {
        if (!user.admin_state || user.admin_state !== 'awaiting_course_selection' || !user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة. يرجى البدء من جديد.");
            return res.status(200).send(await setUserState(userId, null, null));
        }
        const usersToUpdate = user.state_data.users;
        const userObjects = usersToUpdate.map(id => ({ id: id, is_subscribed: true }));
        const { error } = await supabase.from('users').upsert(userObjects, { onConflict: 'id' });
        if (error) { await sendMessage(chatId, `حدث خطأ: ${error.message}`); } 
        else { await sendMessage(chatId, `✅ تم منح صلاحية كاملة لـ ${usersToUpdate.length} مستخدم.`); }
        await setUserState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('assign_course_')) {
         if (!user.admin_state || user.admin_state !== 'awaiting_course_selection' || !user.state_data || !user.state_data.users) {
            await sendMessage(chatId, "خطأ: بيانات الحالة مفقودة. يرجى البدء من جديد.");
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
        const courseName = course ? course.title : 'المحدد';
        await sendMessage(
          chatId,
          `✅ تم إضافة صلاحية كورس ${courseName}.\n اختر كورساً آخر (من القائمة السابقة) أو اضغط "إنهاء".`,
          { inline_keyboard: [[{ text: '👍 إنهاء', callback_data: 'assign_finish' }]] }
        );
        return res.status(200).send('OK');
      }
      if (command === 'assign_finish') {
         await sendMessage(chatId, `👍 تم حفظ الصلاحيات المحددة للمستخدمين.`);
         await setUserState(userId, null, null);
         return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_all_')) {
        const targetUserId = command.split('_')[2];
        await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب "جميع" الصلاحيات من المستخدم ${targetUserId}.`);
        await setUserState(userId, null, null);
        return res.status(200).send('OK');
      }
      if (command.startsWith('revoke_specific_')) {
        const parts = command.split('_');
        const targetUserId = parts[2];
        const courseId = parts[4];
        await supabase.from('user_course_access').delete().match({ user_id: targetUserId, course_id: courseId });
        await supabase.from('users').update({ is_subscribed: false }).eq('id', targetUserId);
        await sendMessage(chatId, `✅ تم سحب صلاحية الكورس. جاري تحديث القائمة...`);
        await sendRevokeMenu(chatId, targetUserId);
        return res.status(200).send('OK');
      }
      if (command.startsWith('admin_grant_access_')) {
        const targetUserId = command.split('_')[3];
        await setUserState(userId, null, null); 
        await fetchAndSendCoursesMenu(
          chatId,
          `🔑 منح صلاحيات للمستخدم ${targetUserId}.\nاختر نوع الصلاحية:`,
          { users: [targetUserId] },
          'assign_course'
        );
        return res.status(200).send('OK');
      }

      // 5. نظام طلبات الاشتراك
      if (command === 'admin_view_requests') {
          await sendPendingRequests(chatId);
          return res.status(200).send('OK');
      }

      if (command.startsWith('reject_sub_')) {
          const requestId = parseInt(command.split('_')[2], 10);
          
          // 1. جلب الطلب (للحصول على ID المستخدم)
          const { data: request, error: reqError } = await supabase
              .from('subscription_requests')
              .select('user_id')
              .eq('id', requestId)
              .single();
              
          if (reqError || !request) {
              await sendMessage(chatId, 'خطأ: لم يتم العثور على هذا الطلب.');
              return res.status(200).send('OK');
          }
          
          // (التحقق إذا تم التعامل معه مسبقاً)
          if (callback_query.message.reply_markup && (!callback_query.message.reply_markup.inline_keyboard || callback_query.message.reply_markup.inline_keyboard.length === 0)) {
               await sendMessage(chatId, 'تم التعامل مع هذا الطلب مسبقاً.');
               return res.status(200).send('OK');
          }

          // 2. وضع الأدمن في حالة انتظار الملاحظة
          await setUserState(userId, 'awaiting_rejection_reason', { 
              request_id: requestId, 
              target_user_id: request.user_id,
              admin_message_id: callback_query.message.message_id, // ID رسالة الصورة
              original_caption: callback_query.message.caption // الكابشن الأصلي
          });
          
          // 3. إبلاغ الأدمن
          await sendMessage(chatId, 'أرسل الآن "سبب الرفض" (سيتم إرسال ملاحظتك للمستخدم، أو اضغط /cancel للإلغاء):');
          return res.status(200).send('OK');
      }
      
      // [ ✅✅ تعديل: ليدعم الاشتراك الشامل أو المحدد ]
      if (command.startsWith('approve_sub_')) {
          const requestId = parseInt(command.split('_')[2], 10);
          
          // [ ✅ تعديل: جلب requested_data ]
          const { data: request, error: reqError } = await supabase
              .from('subscription_requests')
              .select('*, requested_data') // <-- جلب العمود الجديد
              .eq('id', requestId)
              .single();

          if (reqError || !request) {
              await sendMessage(chatId, 'خطأ: لم يتم العثور على هذا الطلب.');
              return res.status(200).send('OK');
          }
          if (request.status === 'approved') {
              await sendMessage(chatId, 'تمت الموافقة على هذا الطلب مسبقاً.');
              return res.status(200).send('OK');
          }

          const targetUserId = request.user_id;
          const courseTitleDesc = request.course_title; // "كورس 1, كورس 2"
          const requestedData = request.requested_data || []; // (e.g., [{id: 1, title: 'A'}, {id: 'all'}])

          let userMessage = '';
          let grantAll = false;

          // [ ✅✅ لوجيك الفصل الجديد ]
          if (requestedData.length > 0 && requestedData.some(c => c.id === 'all')) {
              grantAll = true;
          }

          if (grantAll) {
              // --- منح اشتراك شامل ---
              await supabase.from('users').upsert({ id: targetUserId, is_subscribed: true });
              await supabase.from('user_course_access').delete().eq('user_id', targetUserId);
              
              userMessage = `🎉 تهانينا، تمت الموافقة على اشتراكك!\n\n` +
                            `تم تفعيل "الاشتراك الشامل" (كل الكورسات) لحسابك.\n\n` +
                            `هام جداً:\n` +
                            `هذا هو ID الخاص بك، استخدمه لتسجيل الدخول في التطبيق:\n` +
                            `${targetUserId}`;
          } else {
              // --- منح اشتراك محدد (متعدد) ---
              const accessObjects = requestedData
                  .filter(c => c.id !== 'all') // تجاهل أي شيء آخر
                  .map(course => ({ 
                      user_id: targetUserId, 
                      course_id: course.id 
                  }));
              
              if (accessObjects.length > 0) {
                  await supabase.from('user_course_access').upsert(accessObjects, { onConflict: 'user_id, course_id' });
              }
              await supabase.from('users').upsert({ id: targetUserId, is_subscribed: false }); 
              
              userMessage = `🎉 تهانينا، تمت الموافقة على اشتراكك!\n\n` +
                            `تم تفعيل اشتراكك في الكورسات التالية:\n- ${courseTitleDesc.replace(/, /g, '\n- ')}\n\n` +
                            `هام جداً:\n` +
                            `هذا هو ID الخاص بك، استخدمه لتسجيل الدخول في التطبيق:\n` +
                            `${targetUserId}`;
          }
          
          await supabase.from('subscription_requests').update({ status: 'approved' }).eq('id', requestId);
          await sendMessage(targetUserId, userMessage, null, null, true); // إبلاغ المستخدم (نص عادي، محمي)

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
              await sendMessage(chatId, `✅ تم منح الصلاحية للمستخدم ${targetUserId} بنجاح.`);
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
      user = await getUser(userId); // (يستخدم admin_state)

      if (!user) {
          console.error("User not found on message:", userId);
          return res.status(200).send('OK');
      }

      // أمر /start
     // ... (داخل معالج الرسائل النصية)
// if (message && message.from) {
// ... (الكود الخاص بتعريف user, chatId, text, etc.)

      // أمر /start
      if (text === '/start') {
        if (user.is_admin) {
          // [ ✅ تعديل: تمرير بيانات المستخدم ]
          await sendAdminMenu(chatId, user);
        } else {
          // [ ✅✅ بداية التعديل: رسالة /start للمشتركين ]
          
          // 1. التحقق من الصلاحيات
           const { count, error: accessCheckError } = await supabase.from('user_course_access').select('*', { count: 'exact', head: true }).eq('user_id', userId);
           if (accessCheckError && accessCheckError.code !== 'PGRST116') {
                await sendMessage(chatId, "حدث خطأ أثناء التحقق من صلاحياتك.", null, null, true);
                return res.status(200).send('OK');
           }
          const hasSpecificAccess = count > 0;
          
          // 2. تجهيز زر "طلب اشتراك آخر"
          const requestButtonKeyboard = { 
              inline_keyboard: [[ { text: '📋 طلب اشتراك آخر', callback_data: 'user_request_subscription' } ]] 
          };

          // 3. (الحالة 1: المستخدم مشترك بالفعل)
          if (user.is_subscribed || hasSpecificAccess) {
              
              let message = `أهلاً بك، أنت مشترك بالفعل.\n\n`;
              message += `هذا هو ID الخاص بك (استخدمه لتسجيل الدخول في التطبيق):\n${userId}\n\n`; // <-- عرض الـ ID
              message += `اشتراكك الحالي:`;

              if (user.is_subscribed) {
                  // (اشتراك شامل)
                  message += `\n- 📦 الاشتراك الشامل (كل الكورسات)`;
              } else {
                  // (اشتراك محدد - جلب الكورسات)
                  const { data: accessData, error: accessError } = await supabase
                      .from('user_course_access')
                      .select('courses ( title )') // جلب العنوان من جدول الكورسات
                      .eq('user_id', userId);
                  
                  if (accessData && accessData.length > 0) {
                       accessData.forEach(access => {
                          if (access.courses) { // التأكد أن الكورس لم يُحذف
                              message += `\n- 📚 ${access.courses.title}`;
                          }
                      });
                  }
              }
              
              message += `\n\nيمكنك طلب اشتراك إضافي من الزر أدناه.`;
              
              // إرسال الرسالة مع زر "طلب اشتراك آخر"
              await sendMessage(chatId, message, requestButtonKeyboard, null, true);

          } else {
          // 4. (الحالة 2: المستخدم غير مشترك)
            await setUserState(userId, null, null); 
            const keyboard = { inline_keyboard: [[ { text: '📋 طلب اشتراك', callback_data: 'user_request_subscription' } ]] };
            await sendMessage(chatId, 'أنت غير مشترك في الخدمة. يمكنك طلب اشتراك من الزر أدناه.', keyboard, null, true);
          }
          // [ ✅✅ نهاية التعديل ]
        }
        return res.status(200).send('OK');
      }

// ... (باقي الكود الخاص بمعالجة /cancel والحالات)

      // أمر /cancel
      if (text === '/cancel') {
         await setUserState(userId, null, null);
         await sendMessage(chatId, '👍 تم إلغاء العملية.', null, null, true);
         return res.status(200).send('OK');
      }

      // --- [ معالجة الحالات (State Machine) ] ---
      
      const currentState = user.admin_state; 

      // (1. حالات المستخدم العادي - إرسال صورة)
      if (!user.is_admin && currentState === 'awaiting_payment_proof') {
        if (!message.photo) {
            await sendMessage(chatId, 'الرجاء إرسال صورة فقط (Screenshot) كإثبات. أعد المحاولة أو اضغط /cancel', null, null, true);
            return res.status(200).send('OK');
        }
        
        const stateData = user.state_data;
        if (!stateData || !stateData.selected_courses || stateData.selected_courses.length === 0) {
            await sendMessage(chatId, 'حدث خطأ. بيانات الكورس مفقودة. ابدأ من جديد بالضغط على /start', null, null, true);
            await setUserState(userId, null, null);
            return res.status(200).send('OK');
        }
        
        const payment_file_id = message.photo[message.photo.length - 1].file_id;
        const user_name = `${from.first_name || ''} ${from.last_name || ''}`.trim();
        const user_username = from.username || null;
        
        // [ ✅ تعديل: إنشاء الوصف ]
        const selectedCourses = stateData.selected_courses;
        const courseTitleDesc = selectedCourses.map(c => c.title).join(', ');
        
        // [ ✅ تعديل: حفظ البيانات في العمود الجديد ]
        const { data: newRequest, error: insertError } = await supabase
            .from('subscription_requests')
            .insert({
                user_id: userId, user_name: user_name, user_username: user_username,
                course_id: null, // <-- نتركه null دائماً
                course_title: courseTitleDesc, // <-- الوصف
                requested_data: selectedCourses, // <-- العمود الجديد
                payment_file_id: payment_file_id, status: 'pending'
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
    // [ ... (داخل معالج الرسائل النصية والصور "if (message && message.from)") ]
// ... (بعد معالجة حالة المستخدم العادي "if (!user.is_admin && ...)")

      // (2. حالات الأدمن - إدخال نصي)
     // (2. حالات الأدمن - إدخال نصي)
      if (user.is_admin && currentState) {
        switch (currentState) {

          case 'awaiting_user_ids':
            const ids = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (ids.length === 0) {
              await sendMessage(chatId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
              return res.status(200).send('OK');
            }
            await fetchAndSendCoursesMenu(chatId, `تم تحديد ${ids.length} مستخدم. اختر نوع الصلاحية:`, { users: ids }, 'assign_course');
            break;
            
          case 'awaiting_device_reset_id':
            const resetIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (resetIds.length === 0) {
                await sendMessage(chatId, 'خطأ. أرسل IDs صالحة. حاول مجدداً أو اضغط /cancel');
                return res.status(200).send('OK');
            }
            const { error: deleteError } = await supabase.from('devices').delete().in('user_id', resetIds);
            if (deleteError) { await sendMessage(chatId, `حدث خطأ: ${deleteError.message}`); } 
            else { await sendMessage(chatId, `✅ تم حذف البصمات لـ ${resetIds.length} مستخدم.`); }
            await setUserState(userId, null, null);
            break;
            
          case 'awaiting_user_id_for_revoke':
            const revokeIds = text.split(/\s+/).filter(id => /^\d+$/.test(id));
            if (revokeIds.length !== 1) {
                 await sendMessage(chatId, 'خطأ. هذه الميزة تعمل لمستخدم واحد فقط. أرسل ID واحد.');
                 return res.status(200).send('OK');
            }
            const targetUserId = revokeIds[0];
            await setUserState(userId, null, null);
            await sendRevokeMenu(chatId, targetUserId);
            break;

          // (حالات إدارة المحتوى)
          case 'awaiting_course_title':
            await supabase.from('courses').insert({ title: text });
            await sendMessage(chatId, `✅ تم إضافة الكورس "${text}" بنجاح.`);
            await setUserState(userId, null, null);
            await sendContentMenu_Courses(chatId);
            break;
            
          case 'awaiting_folder_title':
            if (!user.state_data || !user.state_data.course_id) {
               await sendMessage(chatId, "خطأ: بيانات الكورس مفقودة. أعد المحاولة.");
               await setUserState(userId, null, null);
               break;
            }
            await supabase.from('sections').insert({ title: text, course_id: user.state_data.course_id });
            await sendMessage(chatId, `✅ تم إضافة المجلد "${text}" بنجاح.`);
            await sendContentMenu_Folders(chatId, user.state_data.course_id);
            break;
            
          case 'awaiting_video_title':
            if (!user.state_data || !user.state_data.section_id) {
               await sendMessage(chatId, "خطأ: بيانات المجلد مفقودة. أعد المحاولة.");
               await setUserState(userId, null, null);
               break;
            }
            await setUserState(userId, 'awaiting_youtube_id', { 
                section_id: user.state_data.section_id, 
                video_title: text 
            });
            await sendMessage(chatId, `👍 العنوان: "${text}"\n\nالآن أرسل "رابط يوتيوب" الخاص بالفيديو:`);
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
                break;
            }
            await supabase.from('videos').insert({ 
                title: user.state_data.video_title,
                youtube_video_id: videoId,
                section_id: user.state_data.section_id
            });
            await sendMessage(chatId, '✅✅✅ تم إضافة الفيديو بنجاح!');
            await sendContentMenu_Videos(chatId, user.state_data.section_id);
            break;
            
          // --- [ حالة الرفض ] ---
          case 'awaiting_rejection_reason':
            if (!text || text.trim().length === 0) {
                await sendMessage(chatId, 'الرجاء إرسال سبب واضح (نص).');
                return res.status(200).send('OK');
            }
            
            const stateData = user.state_data;
            if (!stateData || !stateData.request_id || !stateData.target_user_id) {
                 await sendMessage(chatId, 'خطأ: الحالة مفقودة. تم الإلغاء.');
                 await setUserState(userId, null, null);
                 return res.status(200).send('OK');
            }

            // 1. إبلاغ المستخدم بالرفض + السبب
            const userMessage = `نأسف، تم رفض طلب اشتراكك.\n\nالسبب: ${text}`;
            await sendMessage(stateData.target_user_id, userMessage, null, null, true);

            // 2. تحديث حالة الطلب في DB
            await supabase
                .from('subscription_requests')
                .update({ status: 'rejected' })
                .eq('id', stateData.request_id);

            // 3. إبلاغ الأدمن
            await sendMessage(chatId, '✅ تم إرسال الرفض والملاحظة للمستخدم.');

            // 4. تعديل رسالة الأدمن الأصلية (الصورة)
            try {
                // (نستخدم الكابشن الأصلي المحفوظ في الحالة)
                const newCaption = stateData.original_caption + 
                                   `\n\n<b>❌ تم الرفض بواسطة:</b> ${from.first_name || 'Admin'}\n<b>السبب:</b> ${text}`;
                
                await axios.post(`${TELEGRAM_API}/editMessageCaption`, {
                      chat_id: chatId,
                      message_id: stateData.admin_message_id,
                      caption: newCaption,
                      parse_mode: 'HTML',
                      reply_markup: null // إزالة الأزرار
                });
            } catch(e) {
                 console.error("Failed to edit admin message after rejection:", e.message);
                 // (حتى لو فشل تعديل الرسالة، العملية نجحت)
            }
            
            // 5. تنظيف الحالة
            await setUserState(userId, null, null);
            break;
           // --- [ (داخل معالج الرسائل النصية، داخل switch حالات الأدمن) ] ---
        
          case 'awaiting_admin_id_to_add':
            // (التحقق من أنه الأدمن الرئيسي)
            if (String(userId) !== process.env.MAIN_ADMIN_ID) {
               await sendMessage(chatId, 'غير مصرح لك.');
               await setUserState(userId, null, null);
               return res.status(200).send('OK');
            }

            const idToAdd = text.trim();
            if (!/^\d+$/.test(idToAdd)) {
                await sendMessage(chatId, 'خطأ. أرسل ID رقمي صالح.');
                return res.status(200).send('OK');
            }
            if (idToAdd === process.env.MAIN_ADMIN_ID) {
                await sendMessage(chatId, 'لا يمكن تعديل الأدمن الرئيسي.');
                return res.status(200).send('OK');
            }

            // التحقق من وجود المستخدم
            const { data: userToAdd, error: fetchError } = await supabase
                .from('users')
                .select('is_admin')
                .eq('id', Number(idToAdd))
                .single();
            
            if (fetchError) {
                await sendMessage(chatId, 'خطأ: هذا المستخدم غير موجود أو لم يبدأ البوت بعد.');
                return res.status(200).send('OK');
            }
            if (userToAdd.is_admin) {
                await sendMessage(chatId, 'هذا المستخدم هو مشرف بالفعل.');
                return res.status(200).send('OK');
            }

            // الترقية
            const { error: addError } = await supabase
                .from('users')
                .update({ is_admin: true })
                .eq('id', Number(idToAdd));
            
            if (addError) {
                await sendMessage(chatId, `حدث خطأ: ${addError.message}`);
            } else {
                await sendMessage(chatId, `✅ تم ترقية المستخدم ${idToAdd} إلى مشرف بنجاح.`);
            }
            await setUserState(userId, null, null);
            await sendAdminManagementMenu(chatId); // العودة وتحديث القائمة
            break;

          // [ ✅✅ تعديل كامل: حالة إزالة مشرف مع التحقق ]
          case 'awaiting_admin_id_to_remove':
            // (التحقق من أنه الأدمن الرئيسي)
            if (String(userId) !== process.env.MAIN_ADMIN_ID) {
               await sendMessage(chatId, 'غير مصرح لك.');
               await setUserState(userId, null, null);
               return res.status(200).send('OK');
            }

            const idToRemove = text.trim();
            if (!/^\d+$/.test(idToRemove)) {
                await sendMessage(chatId, 'خطأ. أرسل ID رقمي صالح.');
                return res.status(200).send('OK');
            }
            if (idToRemove === process.env.MAIN_ADMIN_ID) {
                await sendMessage(chatId, 'لا يمكنك إزالة الأدمن الرئيسي.');
                return res.status(200).send('OK');
            }

            // التحقق من وجود المستخدم
            const { data: userToRemove, error: fetchErrorRemove } = await supabase
                .from('users')
                .select('is_admin')
                .eq('id', Number(idToRemove))
                .single();

            if (fetchErrorRemove) {
                await sendMessage(chatId, 'خطأ: هذا المستخدم غير موجود أصلاً.');
                return res.status(200).send('OK');
            }
            if (!userToRemove.is_admin) {
                await sendMessage(chatId, 'هذا المستخدم ليس مشرفاً.');
                return res.status(200).send('OK');
            }

            // الإزالة
            const { error: removeError } = await supabase
                .from('users')
                .update({ is_admin: false })
                .eq('id', Number(idToRemove));
            
            if (removeError) {
                await sendMessage(chatId, `حدث خطأ: ${removeError.message}`);
            } else {
                await sendMessage(chatId, `✅ تم إزالة المستخدم ${idToRemove} من قائمة المشرفين.`);
            }
            await setUserState(userId, null, null);
            await sendAdminManagementMenu(chatId); // العودة وتحديث القائمة
            break;
          // --- [ نهاية الحالات الجديدة ] ---
        } // نهاية الـ switch
        return res.status(200).send('OK');
      } // [ ✅ قوس إغلاق لـ 'if (user.is_admin && currentState)' ]

      // رسالة عامة (إذا لم يكن في أي حالة)
      if (!currentState) {
        await sendMessage(chatId, 'الأمر غير معروف. اضغط /start', null, null, true);
      }
    } // [ ✅ قوس إغلاق لـ 'if (message && message.from)' ]

  } catch (e) {
    console.error("Error in webhook:", e);
    if (chatId) {
        try {
           await sendMessage(chatId, `حدث خطأ جسيم في الخادم: ${e.message}`, null, null, true);
        } catch (sendError) {
             console.error("Failed to send critical error message:", sendError);
        }
    }
  } // [ ✅ قوس إغلاق لـ 'try...catch' الرئيسي ]

  res.status(200).send('OK');
}; // [ ✅ قوس إغلاق لـ 'export default' ]
